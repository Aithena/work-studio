import { recordOperation } from './activity'
import { nowIso, type NoteRow } from './env'

const DEFAULT_TITLE = '默认笔记'

function plainTextLength(html: string): number {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim().length
}

function normalizeTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim()
}

export async function listNotes(db: D1Database): Promise<NoteRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM notes ORDER BY sort_order ASC, id ASC')
    .all<NoteRow>()
  return results ?? []
}

export async function getNote(db: D1Database, id?: number | null): Promise<NoteRow | undefined> {
  if (id != null) {
    const row = await db.prepare('SELECT * FROM notes WHERE id = ?').bind(id).first<NoteRow>()
    return row ?? undefined
  }
  const preferred = await db.prepare('SELECT * FROM notes WHERE id = 1').first<NoteRow>()
  if (preferred) return preferred
  const row = await db
    .prepare('SELECT * FROM notes WHERE disabled = 0 ORDER BY sort_order ASC, id ASC LIMIT 1')
    .first<NoteRow>()
  return row ?? undefined
}

export async function ensureDefaultNote(db: D1Database): Promise<NoteRow> {
  const existing = (await getNote(db, 1)) ?? (await getNote(db))
  if (existing) return existing
  const ts = nowIso()
  await db
    .prepare(
      'INSERT INTO notes (id, title, content, disabled, sort_order, created_at, updated_at) VALUES (1, ?, ?, 0, 0, ?, ?)',
    )
    .bind(DEFAULT_TITLE, '', ts, ts)
    .run()
  return {
    id: 1,
    title: DEFAULT_TITLE,
    content: '',
    disabled: 0,
    sort_order: 0,
    created_at: ts,
    updated_at: ts,
  }
}

async function countEnabled(db: D1Database, exceptId?: number): Promise<number> {
  if (exceptId == null) {
    const row = await db
      .prepare('SELECT COUNT(*) AS n FROM notes WHERE disabled = 0')
      .first<{ n: number }>()
    return row?.n ?? 0
  }
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM notes WHERE disabled = 0 AND id != ?')
    .bind(exceptId)
    .first<{ n: number }>()
  return row?.n ?? 0
}

async function nextSortOrder(db: D1Database): Promise<number> {
  const row = await db.prepare('SELECT MAX(sort_order) AS n FROM notes').first<{ n: number | null }>()
  return (row?.n ?? -1) + 1
}

export async function createNote(db: D1Database, title: string): Promise<NoteRow> {
  const nextTitle = normalizeTitle(title) || '未命名笔记'
  const ts = nowIso()
  const sortOrder = await nextSortOrder(db)
  const result = await db
    .prepare(
      'INSERT INTO notes (title, content, disabled, sort_order, created_at, updated_at) VALUES (?, ?, 0, ?, ?, ?)',
    )
    .bind(nextTitle, '', sortOrder, ts, ts)
    .run()
  const id = Number(result.meta.last_row_id)
  await recordOperation(db, {
    action: 'note.create',
    targetType: 'note',
    targetId: id,
    summary: `新增笔记「${nextTitle}」`,
  })
  return (await getNote(db, id))!
}

export async function updateNote(
  db: D1Database,
  id: number,
  patch: { title?: string; disabled?: boolean },
): Promise<NoteRow> {
  const current = await getNote(db, id)
  if (!current) throw new Error('笔记不存在')

  let title = current.title
  let disabled = current.disabled

  if (patch.title != null) {
    const nextTitle = normalizeTitle(patch.title)
    if (!nextTitle) throw new Error('名称不能为空')
    title = nextTitle
  }

  if (patch.disabled != null) {
    if (patch.disabled && current.disabled === 0 && (await countEnabled(db, id)) === 0) {
      throw new Error('至少保留一篇可用笔记')
    }
    disabled = patch.disabled ? 1 : 0
  }

  const ts = nowIso()
  await db
    .prepare('UPDATE notes SET title = ?, disabled = ?, updated_at = ? WHERE id = ?')
    .bind(title, disabled, ts, id)
    .run()

  if (patch.title != null && title !== current.title) {
    await recordOperation(db, {
      action: 'note.update',
      targetType: 'note',
      targetId: id,
      summary: `重命名为「${title}」`,
    })
  }
  if (patch.disabled != null && disabled !== current.disabled) {
    await recordOperation(db, {
      action: disabled ? 'note.disable' : 'note.enable',
      targetType: 'note',
      targetId: id,
      summary: disabled ? `停用「${title}」` : `启用「${title}」`,
    })
  }

  return (await getNote(db, id))!
}

export async function deleteNote(db: D1Database, id: number): Promise<NoteRow> {
  const current = await getNote(db, id)
  if (!current) throw new Error('笔记不存在')
  if (current.disabled === 0 && (await countEnabled(db, id)) === 0) {
    throw new Error('至少保留一篇可用笔记')
  }

  await db.prepare('DELETE FROM notes WHERE id = ?').bind(id).run()
  await recordOperation(db, {
    action: 'note.delete',
    targetType: 'note',
    targetId: id,
    summary: `删除笔记「${current.title}」`,
  })
  return current
}

export async function reorderNotes(db: D1Database, ids: number[]): Promise<void> {
  const stmts = ids.map((noteId, index) =>
    db.prepare('UPDATE notes SET sort_order = ? WHERE id = ?').bind(index, noteId),
  )
  if (stmts.length) await db.batch(stmts)
}

export async function saveNote(
  db: D1Database,
  content: string,
  id?: number | null,
): Promise<NoteRow> {
  const current = id != null ? await getNote(db, id) : await ensureDefaultNote(db)
  if (!current) throw new Error('笔记不存在')
  if (current.disabled === 1) throw new Error('笔记已停用')

  const ts = nowIso()
  await db
    .prepare('UPDATE notes SET content = ?, updated_at = ? WHERE id = ?')
    .bind(content, ts, current.id)
    .run()

  if (current.content !== content) {
    const before = plainTextLength(current.content)
    const after = plainTextLength(content)
    const delta = Math.max(0, after - before)
    await recordOperation(db, {
      action: 'note.save',
      targetType: 'note',
      targetId: current.id,
      summary: `保存「${current.title}」`,
      chars: delta > 0 ? delta : after > 0 ? 1 : 0,
    })
  }

  return (await getNote(db, current.id))!
}

export async function replaceNotes(
  db: D1Database,
  notes: Array<{
    id?: number
    title: string
    content: string
    disabled?: boolean
    sortOrder?: number
    createdAt?: string
    updatedAt?: string
  }>,
): Promise<void> {
  const ts = nowIso()
  await db.prepare('DELETE FROM notes').run()

  const stmts: D1PreparedStatement[] = []
  notes.forEach((item, index) => {
    const title = normalizeTitle(item.title) || DEFAULT_TITLE
    const content = typeof item.content === 'string' ? item.content : ''
    const disabled = item.disabled ? 1 : 0
    const sortOrder = Number.isFinite(item.sortOrder) ? (item.sortOrder as number) : index
    const createdAt = typeof item.createdAt === 'string' && item.createdAt ? item.createdAt : ts
    const updatedAt = typeof item.updatedAt === 'string' && item.updatedAt ? item.updatedAt : ts
    if (Number.isInteger(item.id) && (item.id as number) > 0) {
      stmts.push(
        db
          .prepare(
            'INSERT INTO notes (id, title, content, disabled, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          )
          .bind(item.id, title, content, disabled, sortOrder, createdAt, updatedAt),
      )
    } else {
      stmts.push(
        db
          .prepare(
            'INSERT INTO notes (title, content, disabled, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .bind(title, content, disabled, sortOrder, createdAt, updatedAt),
      )
    }
  })
  if (stmts.length) await db.batch(stmts)

  if ((await countEnabled(db)) === 0) await ensureDefaultNote(db)
}
