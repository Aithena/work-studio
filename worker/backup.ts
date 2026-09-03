import JSZip from 'jszip'
import { ensureDefaultNote, listNotes, replaceNotes } from './notes'
import { nowIso, type TodoPriority, type TodoRow } from './env'
import { isSafeUploadName } from './uploads'

type NoteBackup = {
  id?: number
  title: string
  content: string
  disabled: boolean
  sortOrder?: number
  createdAt: string
  updatedAt: string
}

type BackupPayload = {
  version: 1 | 2
  exportedAt: string
  note?: { content: string; updatedAt: string }
  notes?: NoteBackup[]
  todos: Array<{
    content: string
    completed: boolean
    deleted: boolean
    hidden: boolean
    priority: TodoPriority | null
    sortOrder: number
    createdAt: string
    updatedAt: string
    completedAt: string | null
    deletedAt: string | null
    hiddenAt: string | null
  }>
}

function isPriority(value: unknown): value is TodoPriority | null {
  if (value == null) return true
  return value === 'P0' || value === 'P1' || value === 'P2' || value === 'P3'
}

async function buildDataPayload(db: D1Database): Promise<BackupPayload> {
  const notes = await listNotes(db)
  const fallback = notes.find((row) => row.id === 1) ?? notes[0]
  const { results } = await db.prepare('SELECT * FROM todos ORDER BY id ASC').all<TodoRow>()
  const rows = results ?? []

  return {
    version: 2,
    exportedAt: nowIso(),
    note: {
      content: fallback?.content ?? '',
      updatedAt: fallback?.updated_at ?? nowIso(),
    },
    notes: notes.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      disabled: row.disabled === 1,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    todos: rows.map((row) => ({
      content: row.content,
      completed: row.completed === 1,
      deleted: row.deleted === 1,
      hidden: row.hidden === 1,
      priority: row.priority,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      deletedAt: row.deleted_at,
      hiddenAt: row.hidden_at,
    })),
  }
}

async function clearUploads(bucket: R2Bucket): Promise<void> {
  let cursor: string | undefined
  do {
    const listed = await bucket.list({ cursor, limit: 1000 })
    await Promise.all(listed.objects.map((obj) => bucket.delete(obj.key)))
    cursor = listed.truncated ? listed.cursor : undefined
  } while (cursor)
}

async function applyPayloadData(db: D1Database, data: BackupPayload): Promise<number> {
  if (!Array.isArray(data.todos)) throw new Error('缺少任务数据')

  const noteItems: NoteBackup[] =
    Array.isArray(data.notes) && data.notes.length > 0
      ? data.notes
      : data.note && typeof data.note.content === 'string'
        ? [
            {
              id: 1,
              title: '默认笔记',
              content: data.note.content,
              disabled: false,
              createdAt: data.note.updatedAt,
              updatedAt: data.note.updatedAt,
            },
          ]
        : []
  if (noteItems.length === 0) throw new Error('缺少笔记数据')

  const ts = nowIso()
  await db.prepare('DELETE FROM todos').run()

  const stmts: D1PreparedStatement[] = []
  for (const item of data.todos) {
    if (!item || typeof item.content !== 'string' || !item.content.trim()) continue
    if (!isPriority(item.priority ?? null)) throw new Error('任务优先级无效')
    stmts.push(
      db
        .prepare(
          `
          INSERT INTO todos (
            content, completed, deleted, hidden, priority, sort_order,
            created_at, updated_at, completed_at, deleted_at, hidden_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        )
        .bind(
          item.content.trim(),
          item.completed ? 1 : 0,
          item.deleted ? 1 : 0,
          item.hidden ? 1 : 0,
          item.priority ?? null,
          Number.isFinite(item.sortOrder) ? item.sortOrder : 0,
          typeof item.createdAt === 'string' ? item.createdAt : ts,
          typeof item.updatedAt === 'string' ? item.updatedAt : ts,
          item.completedAt ?? null,
          item.deletedAt ?? null,
          item.hiddenAt ?? null,
        ),
    )
  }
  if (stmts.length) await db.batch(stmts)

  await replaceNotes(db, noteItems)
  await ensureDefaultNote(db)

  return data.todos.filter((t) => t && typeof t.content === 'string' && t.content.trim()).length
}

export async function buildExportZip(
  db: D1Database,
  bucket: R2Bucket,
): Promise<{ filename: string; bytes: Uint8Array }> {
  const payload = await buildDataPayload(db)
  const zip = new JSZip()
  zip.file('data.json', JSON.stringify(payload, null, 2))

  const folder = zip.folder('uploads')
  let cursor: string | undefined
  do {
    const listed = await bucket.list({ cursor, limit: 1000 })
    for (const obj of listed.objects) {
      if (!isSafeUploadName(obj.key)) continue
      const body = await bucket.get(obj.key)
      if (!body) continue
      const bytes = new Uint8Array(await body.arrayBuffer())
      folder?.file(obj.key, bytes)
    }
    cursor = listed.truncated ? listed.cursor : undefined
  } while (cursor)

  const buffer = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  const day = payload.exportedAt.slice(0, 10)
  return {
    filename: `workbench-backup-${day}.zip`,
    bytes: buffer,
  }
}

export async function importBackupZip(
  db: D1Database,
  bucket: R2Bucket,
  buffer: ArrayBuffer,
): Promise<{ todoCount: number; imageCount: number }> {
  const zip = await JSZip.loadAsync(buffer)
  const dataFile = zip.file('data.json')
  if (!dataFile) throw new Error('压缩包内缺少 data.json')

  let data: BackupPayload
  try {
    data = JSON.parse(await dataFile.async('string')) as BackupPayload
  } catch {
    throw new Error('data.json 不是合法 JSON')
  }

  if (data.version !== 1 && data.version !== 2) throw new Error('不支持的备份版本')

  await clearUploads(bucket)
  const todoCount = await applyPayloadData(db, data)

  let imageCount = 0
  const uploadFiles = Object.values(zip.files).filter(
    (f) => !f.dir && /^uploads\/[^/]+$/.test(f.name.replace(/\\/g, '/')),
  )
  for (const file of uploadFiles) {
    const name = file.name.split('/').pop() || file.name
    if (!isSafeUploadName(name)) continue
    const bytes = await file.async('uint8array')
    await bucket.put(name, bytes)
    imageCount += 1
  }

  return { todoCount, imageCount }
}
