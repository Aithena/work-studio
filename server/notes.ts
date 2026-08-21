import { getDb, nowIso, type NoteRow } from './db'
import { recordOperation } from './activity'

function plainTextLength(html: string): number {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim().length
}

export function getNote(): NoteRow {
  const row = getDb().prepare('SELECT * FROM notes WHERE id = 1').get() as NoteRow | undefined
  if (row) return row

  const ts = nowIso()
  getDb().prepare('INSERT INTO notes (id, content, updated_at) VALUES (1, ?, ?)').run('', ts)
  return { id: 1, content: '', updated_at: ts }
}

export function saveNote(content: string): NoteRow {
  const current = getNote()
  const ts = nowIso()
  getDb()
    .prepare('UPDATE notes SET content = ?, updated_at = ? WHERE id = 1')
    .run(content, ts)

  if (current.content !== content) {
    const before = plainTextLength(current.content)
    const after = plainTextLength(content)
    const delta = Math.max(0, after - before)
    recordOperation({
      action: 'note.save',
      targetType: 'note',
      targetId: 1,
      summary: '保存笔记',
      chars: delta > 0 ? delta : after > 0 ? 1 : 0,
    })
  }

  return getNote()
}
