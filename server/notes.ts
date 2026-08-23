import { getDb, nowIso, type NoteRow } from './db'
import { recordOperation } from './activity'

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

export function listNotes(): NoteRow[] {
  return getDb().prepare('SELECT * FROM notes ORDER BY id ASC').all() as NoteRow[]
}

export function getNote(id?: number | null): NoteRow | undefined {
  if (id != null) {
    return getDb().prepare('SELECT * FROM notes WHERE id = ?').get(id) as NoteRow | undefined
  }
  const preferred = getDb().prepare('SELECT * FROM notes WHERE id = 1').get() as NoteRow | undefined
  if (preferred) return preferred
  return getDb()
    .prepare('SELECT * FROM notes WHERE disabled = 0 ORDER BY id ASC LIMIT 1')
    .get() as NoteRow | undefined
}

export function ensureDefaultNote(): NoteRow {
  const existing = getNote(1) ?? getNote()
  if (existing) return existing
  const ts = nowIso()
  getDb()
    .prepare(
      'INSERT INTO notes (id, title, content, disabled, created_at, updated_at) VALUES (1, ?, ?, 0, ?, ?)',
    )
    .run(DEFAULT_TITLE, '', ts, ts)
  return { id: 1, title: DEFAULT_TITLE, content: '', disabled: 0, created_at: ts, updated_at: ts }
}

function countEnabled(exceptId?: number): number {
  if (exceptId == null) {
    const row = getDb().prepare('SELECT COUNT(*) AS n FROM notes WHERE disabled = 0').get() as { n: number }
    return row.n
  }
  const row = getDb()
    .prepare('SELECT COUNT(*) AS n FROM notes WHERE disabled = 0 AND id != ?')
    .get(exceptId) as { n: number }
  return row.n
}

export function createNote(title: string): NoteRow {
  const nextTitle = normalizeTitle(title) || '未命名笔记'
  const ts = nowIso()
  const result = getDb()
    .prepare(
      'INSERT INTO notes (title, content, disabled, created_at, updated_at) VALUES (?, ?, 0, ?, ?)',
    )
    .run(nextTitle, '', ts, ts)
  const id = Number(result.lastInsertRowid)
  recordOperation({
    action: 'note.create',
    targetType: 'note',
    targetId: id,
    summary: `新增笔记「${nextTitle}」`,
  })
  return getNote(id)!
}

export function updateNote(
  id: number,
  patch: { title?: string; disabled?: boolean },
): NoteRow {
  const current = getNote(id)
  if (!current) throw new Error('笔记不存在')

  let title = current.title
  let disabled = current.disabled

  if (patch.title != null) {
    const nextTitle = normalizeTitle(patch.title)
    if (!nextTitle) throw new Error('名称不能为空')
    title = nextTitle
  }

  if (patch.disabled != null) {
    if (patch.disabled && current.disabled === 0 && countEnabled(id) === 0) {
      throw new Error('至少保留一篇可用笔记')
    }
    disabled = patch.disabled ? 1 : 0
  }

  const ts = nowIso()
  getDb()
    .prepare('UPDATE notes SET title = ?, disabled = ?, updated_at = ? WHERE id = ?')
    .run(title, disabled, ts, id)

  if (patch.title != null && title !== current.title) {
    recordOperation({
      action: 'note.update',
      targetType: 'note',
      targetId: id,
      summary: `重命名为「${title}」`,
    })
  }
  if (patch.disabled != null && disabled !== current.disabled) {
    recordOperation({
      action: disabled ? 'note.disable' : 'note.enable',
      targetType: 'note',
      targetId: id,
      summary: disabled ? `停用「${title}」` : `启用「${title}」`,
    })
  }

  return getNote(id)!
}

export function deleteNote(id: number): NoteRow {
  const current = getNote(id)
  if (!current) throw new Error('笔记不存在')
  if (current.disabled === 0 && countEnabled(id) === 0) {
    throw new Error('至少保留一篇可用笔记')
  }

  getDb().prepare('DELETE FROM notes WHERE id = ?').run(id)
  recordOperation({
    action: 'note.delete',
    targetType: 'note',
    targetId: id,
    summary: `删除笔记「${current.title}」`,
  })
  return current
}

export function saveNote(content: string, id?: number | null): NoteRow {
  const current = id != null ? getNote(id) : ensureDefaultNote()
  if (!current) throw new Error('笔记不存在')
  if (current.disabled === 1) throw new Error('笔记已停用')

  const ts = nowIso()
  getDb()
    .prepare('UPDATE notes SET content = ?, updated_at = ? WHERE id = ?')
    .run(content, ts, current.id)

  if (current.content !== content) {
    const before = plainTextLength(current.content)
    const after = plainTextLength(content)
    const delta = Math.max(0, after - before)
    recordOperation({
      action: 'note.save',
      targetType: 'note',
      targetId: current.id,
      summary: `保存「${current.title}」`,
      chars: delta > 0 ? delta : after > 0 ? 1 : 0,
    })
  }

  return getNote(current.id)!
}

export function replaceNotes(
  notes: Array<{
    id?: number
    title: string
    content: string
    disabled?: boolean
    createdAt?: string
    updatedAt?: string
  }>,
): void {
  const ts = nowIso()
  const db = getDb()
  const insert = db.prepare(
    'INSERT INTO notes (id, title, content, disabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
  const insertAuto = db.prepare(
    'INSERT INTO notes (title, content, disabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
  )

  const run = db.transaction(() => {
    db.prepare('DELETE FROM notes').run()
    for (const item of notes) {
      const title = normalizeTitle(item.title) || DEFAULT_TITLE
      const content = typeof item.content === 'string' ? item.content : ''
      const disabled = item.disabled ? 1 : 0
      const createdAt = typeof item.createdAt === 'string' && item.createdAt ? item.createdAt : ts
      const updatedAt = typeof item.updatedAt === 'string' && item.updatedAt ? item.updatedAt : ts
      if (Number.isInteger(item.id) && (item.id as number) > 0) {
        insert.run(item.id, title, content, disabled, createdAt, updatedAt)
      } else {
        insertAuto.run(title, content, disabled, createdAt, updatedAt)
      }
    }
  })
  run()

  if (countEnabled() === 0) ensureDefaultNote()
}
