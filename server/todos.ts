import { getDb, nowIso, type TodoCounts, type TodoRow } from './db'
import { recordOperation } from './activity'

export type TodoFilter = 'all' | 'active' | 'completed' | 'deleted'

export function getCounts(): TodoCounts {
  const row = getDb()
    .prepare(
      `
      SELECT
        SUM(CASE WHEN deleted = 0 AND completed = 0 THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN deleted = 0 AND completed = 1 THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN deleted = 1 THEN 1 ELSE 0 END) AS deleted
      FROM todos
    `,
    )
    .get() as { active: number | null; completed: number | null; deleted: number | null }

  return {
    active: row.active ?? 0,
    completed: row.completed ?? 0,
    deleted: row.deleted ?? 0,
  }
}

export function listTodos(filter: TodoFilter): TodoRow[] {
  const db = getDb()

  if (filter === 'deleted') {
    return db
      .prepare(
        `
        SELECT * FROM todos
        WHERE deleted = 1
        ORDER BY updated_at DESC, id DESC
      `,
      )
      .all() as TodoRow[]
  }

  if (filter === 'active') {
    return db
      .prepare(
        `
        SELECT * FROM todos
        WHERE deleted = 0 AND completed = 0
        ORDER BY sort_order ASC, id ASC
      `,
      )
      .all() as TodoRow[]
  }

  if (filter === 'completed') {
    return db
      .prepare(
        `
        SELECT * FROM todos
        WHERE deleted = 0 AND completed = 1
        ORDER BY sort_order ASC, id ASC
      `,
      )
      .all() as TodoRow[]
  }

  return db
    .prepare(
      `
      SELECT * FROM todos
      WHERE deleted = 0
      ORDER BY completed ASC, sort_order ASC, id ASC
    `,
    )
    .all() as TodoRow[]
}

export function getTodo(id: number): TodoRow | undefined {
  return getDb().prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow | undefined
}

function nextActiveSortOrder(): number {
  const row = getDb()
    .prepare(
      `
      SELECT MIN(sort_order) AS min_sort
      FROM todos
      WHERE deleted = 0 AND completed = 0
    `,
    )
    .get() as { min_sort: number | null }

  if (row.min_sort == null) return 0
  return row.min_sort - 1
}

function insertTodo(content: string): TodoRow {
  const ts = nowIso()
  const sortOrder = nextActiveSortOrder()
  const result = getDb()
    .prepare(
      `
      INSERT INTO todos (content, completed, deleted, sort_order, created_at, updated_at, completed_at)
      VALUES (?, 0, 0, ?, ?, ?, NULL)
    `,
    )
    .run(content, sortOrder, ts, ts)

  const row = getTodo(Number(result.lastInsertRowid))
  if (!row) throw new Error('failed to create todo')
  return row
}

export function createTodo(content: string): TodoRow {
  const row = insertTodo(content)
  recordOperation({
    action: 'todo.create',
    targetType: 'todo',
    targetId: row.id,
    summary: content.slice(0, 80),
  })
  return row
}

export function createTodos(contents: string[]): TodoRow[] {
  const created: TodoRow[] = []
  const insert = getDb().transaction((lines: string[]) => {
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      created.unshift(insertTodo(lines[i]))
    }
  })
  insert(contents)

  recordOperation({
    action: 'todo.import',
    targetType: 'todo',
    summary: `导入 ${created.length} 条任务`,
    weight: created.length,
  })

  return created
}

export function updateTodo(
  id: number,
  patch: { content?: string; completed?: boolean; deleted?: boolean },
): TodoRow | undefined {
  const current = getTodo(id)
  if (!current) return undefined

  const ts = nowIso()
  let content = current.content
  let completed = current.completed
  let deleted = current.deleted
  let completedAt = current.completed_at

  if (patch.content != null) content = patch.content
  if (patch.completed != null) {
    completed = patch.completed ? 1 : 0
    completedAt = patch.completed ? ts : null
  }
  if (patch.deleted != null) deleted = patch.deleted ? 1 : 0

  const changed =
    content !== current.content ||
    completed !== current.completed ||
    deleted !== current.deleted

  if (!changed) return current

  getDb()
    .prepare(
      `
      UPDATE todos
      SET content = ?, completed = ?, deleted = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
    `,
    )
    .run(content, completed, deleted, completedAt, ts, id)

  if (patch.deleted != null && deleted !== current.deleted) {
    recordOperation({
      action: deleted ? 'todo.delete' : 'todo.restore',
      targetType: 'todo',
      targetId: id,
      summary: content.slice(0, 80),
    })
  } else if (patch.completed != null && completed !== current.completed) {
    recordOperation({
      action: completed ? 'todo.complete' : 'todo.uncomplete',
      targetType: 'todo',
      targetId: id,
      summary: content.slice(0, 80),
    })
  } else if (patch.content != null && content !== current.content) {
    recordOperation({
      action: 'todo.update',
      targetType: 'todo',
      targetId: id,
      summary: content.slice(0, 80),
    })
  }

  return getTodo(id)
}

export function softDeleteTodo(id: number): TodoRow | undefined {
  return updateTodo(id, { deleted: true })
}

export function reorderTodos(ids: number[]): void {
  const db = getDb()
  const ts = nowIso()
  const stmt = db.prepare('UPDATE todos SET sort_order = ?, updated_at = ? WHERE id = ?')
  const run = db.transaction((orderedIds: number[]) => {
    orderedIds.forEach((todoId, index) => {
      stmt.run(index, ts, todoId)
    })
  })
  run(ids)
  // 拖拽排序不记操作日志，避免噪音
}
