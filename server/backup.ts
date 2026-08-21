import fs from 'node:fs'
import path from 'node:path'
import { BACKUP_DIR, DB_PATH, getDb, nowIso, type TodoPriority, type TodoRow } from './db'
import { getNote, saveNote } from './notes'

/** 每天最多自动备份 1 份；保留最近 N 天 */
const KEEP_DAYS = 14

export type BackupPayload = {
  version: 1
  exportedAt: string
  note: { content: string; updatedAt: string }
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

function todayKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function pruneOldBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((name) => /^note-\d{4}-\d{2}-\d{2}\.db$/.test(name))
    .sort()
    .reverse()

  for (const name of files.slice(KEEP_DAYS)) {
    try {
      fs.unlinkSync(path.join(BACKUP_DIR, name))
    } catch {
      // ignore prune errors
    }
  }
}

/** 每日自动备份：启动时若今日尚无备份则复制库文件，并清理过期备份 */
export function ensureDailyBackup(force = false): { created: boolean; path: string | null } {
  getDb()
  fs.mkdirSync(BACKUP_DIR, { recursive: true })

  const dest = path.join(BACKUP_DIR, `note-${todayKey()}.db`)
  if (!force && fs.existsSync(dest)) {
    pruneOldBackups()
    return { created: false, path: dest }
  }

  try {
    const db = getDb()
    db.pragma('wal_checkpoint(TRUNCATE)')
    fs.copyFileSync(DB_PATH, dest)
    pruneOldBackups()
    console.log(`[work-studio] daily backup → ${dest}`)
    return { created: true, path: dest }
  } catch (error) {
    console.warn('[work-studio] daily backup failed', error)
    return { created: false, path: null }
  }
}

export function buildExportPayload(): BackupPayload {
  const db = getDb()
  const note = getNote()
  const rows = db.prepare('SELECT * FROM todos ORDER BY id ASC').all() as TodoRow[]

  return {
    version: 1,
    exportedAt: nowIso(),
    note: {
      content: note.content,
      updatedAt: note.updated_at,
    },
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

function isPriority(value: unknown): value is TodoPriority | null {
  if (value == null) return true
  return value === 'P0' || value === 'P1' || value === 'P2' || value === 'P3'
}

export function importBackupPayload(raw: unknown): { todoCount: number } {
  if (!raw || typeof raw !== 'object') throw new Error('备份文件格式无效')
  const data = raw as Partial<BackupPayload>
  if (data.version !== 1) throw new Error('不支持的备份版本')
  if (!data.note || typeof data.note.content !== 'string') throw new Error('缺少笔记数据')
  if (!Array.isArray(data.todos)) throw new Error('缺少任务数据')

  const db = getDb()
  const ts = nowIso()

  const insert = db.prepare(
    `
    INSERT INTO todos (
      content, completed, deleted, hidden, priority, sort_order,
      created_at, updated_at, completed_at, deleted_at, hidden_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  )

  const run = db.transaction(() => {
    db.prepare('DELETE FROM todos').run()
    for (const item of data.todos!) {
      if (!item || typeof item.content !== 'string' || !item.content.trim()) continue
      if (!isPriority(item.priority ?? null)) throw new Error('任务优先级无效')
      insert.run(
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
      )
    }
    saveNote(data.note!.content)
  })

  run()
  ensureDailyBackup(true)
  return { todoCount: data.todos.filter((t) => t && typeof t.content === 'string' && t.content.trim()).length }
}
