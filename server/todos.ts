import { getDb, nowIso, type TodoCounts, type TodoPriority, type TodoRow } from './db'
import { recordOperation } from './activity'

export type TodoFilter = 'all' | 'active' | 'completed' | 'deleted'

const MS_DAY = 24 * 60 * 60 * 1000
/** 已完成满 7 天 → 回收站 */
const COMPLETED_TO_TRASH_DAYS = 7
/** 回收站满 30 天 → 前端无痕（hidden，仍留库） */
const TRASH_TO_HIDDEN_DAYS = 30

/** 未完成区：P0 → P1 → P2 → 未打标 → P3；已完成区不看 priority */
const ACTIVE_PRIORITY_ORDER = `
  CASE priority
    WHEN 'P0' THEN 0
    WHEN 'P1' THEN 1
    WHEN 'P2' THEN 2
    WHEN 'P3' THEN 4
    ELSE 3
  END
`

function parseTs(value: string | null | undefined): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

/** 自动流转：已完成→回收站→无痕清除。不写操作日志，避免噪音。 */
export function runTodoLifecycle(): void {
  const db = getDb()
  const now = Date.now()
  const ts = nowIso()

  const completedRows = db
    .prepare(
      `
      SELECT id, completed_at, updated_at
      FROM todos
      WHERE hidden = 0 AND deleted = 0 AND completed = 1
    `,
    )
    .all() as { id: number; completed_at: string | null; updated_at: string }[]

  const toTrash = completedRows.filter((row) => {
    const base = parseTs(row.completed_at) ?? parseTs(row.updated_at)
    if (base == null) return false
    return now - base >= COMPLETED_TO_TRASH_DAYS * MS_DAY
  })

  if (toTrash.length) {
    const stmt = db.prepare(
      `
      UPDATE todos
      SET deleted = 1, deleted_at = ?, updated_at = ?
      WHERE id = ?
    `,
    )
    const run = db.transaction((rows: { id: number }[]) => {
      for (const row of rows) stmt.run(ts, ts, row.id)
    })
    run(toTrash)
  }

  const trashRows = db
    .prepare(
      `
      SELECT id, deleted_at, updated_at
      FROM todos
      WHERE hidden = 0 AND deleted = 1
    `,
    )
    .all() as { id: number; deleted_at: string | null; updated_at: string }[]

  const toHidden = trashRows.filter((row) => {
    const base = parseTs(row.deleted_at) ?? parseTs(row.updated_at)
    if (base == null) return false
    return now - base >= TRASH_TO_HIDDEN_DAYS * MS_DAY
  })

  if (toHidden.length) {
    const stmt = db.prepare(
      `
      UPDATE todos
      SET hidden = 1, hidden_at = ?, updated_at = ?
      WHERE id = ?
    `,
    )
    const run = db.transaction((rows: { id: number }[]) => {
      for (const row of rows) stmt.run(ts, ts, row.id)
    })
    run(toHidden)
  }
}

export function getCounts(): TodoCounts {
  runTodoLifecycle()
  const row = getDb()
    .prepare(
      `
      SELECT
        SUM(CASE WHEN hidden = 0 AND deleted = 0 AND completed = 0 THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN hidden = 0 AND deleted = 0 AND completed = 1 THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN hidden = 0 AND deleted = 1 THEN 1 ELSE 0 END) AS deleted
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
  runTodoLifecycle()
  const db = getDb()

  if (filter === 'deleted') {
    return db
      .prepare(
        `
        SELECT * FROM todos
        WHERE hidden = 0 AND deleted = 1
        ORDER BY COALESCE(deleted_at, updated_at) DESC, id DESC
      `,
      )
      .all() as TodoRow[]
  }

  if (filter === 'active') {
    return db
      .prepare(
        `
        SELECT * FROM todos
        WHERE hidden = 0 AND deleted = 0 AND completed = 0
        ORDER BY ${ACTIVE_PRIORITY_ORDER} ASC, sort_order ASC, id ASC
      `,
      )
      .all() as TodoRow[]
  }

  if (filter === 'completed') {
    return db
      .prepare(
        `
        SELECT * FROM todos
        WHERE hidden = 0 AND deleted = 0 AND completed = 1
        ORDER BY sort_order ASC, id ASC
      `,
      )
      .all() as TodoRow[]
  }

  return db
    .prepare(
      `
      SELECT * FROM todos
      WHERE hidden = 0 AND deleted = 0
      ORDER BY
        completed ASC,
        CASE WHEN completed = 1 THEN 0 ELSE ${ACTIVE_PRIORITY_ORDER} END ASC,
        sort_order ASC,
        id ASC
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
      WHERE hidden = 0 AND deleted = 0 AND completed = 0
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
      INSERT INTO todos (
        content, completed, deleted, hidden, priority, sort_order,
        created_at, updated_at, completed_at, deleted_at, hidden_at
      )
      VALUES (?, 0, 0, 0, NULL, ?, ?, ?, NULL, NULL, NULL)
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
  patch: {
    content?: string
    completed?: boolean
    deleted?: boolean
    priority?: TodoPriority | null
  },
): TodoRow | undefined {
  const current = getTodo(id)
  if (!current || current.hidden === 1) return undefined

  const ts = nowIso()
  let content = current.content
  let completed = current.completed
  let deleted = current.deleted
  let priority = current.priority
  let completedAt = current.completed_at
  let deletedAt = current.deleted_at

  if (patch.content != null) content = patch.content
  if (patch.completed != null) {
    completed = patch.completed ? 1 : 0
    completedAt = patch.completed ? ts : null
  }
  if (patch.deleted != null) {
    deleted = patch.deleted ? 1 : 0
    deletedAt = patch.deleted ? ts : null
  }
  if (patch.priority !== undefined) priority = patch.priority

  const changed =
    content !== current.content ||
    completed !== current.completed ||
    deleted !== current.deleted ||
    priority !== current.priority

  if (!changed) return current

  getDb()
    .prepare(
      `
      UPDATE todos
      SET content = ?, completed = ?, deleted = ?, priority = ?,
          completed_at = ?, deleted_at = ?, updated_at = ?
      WHERE id = ?
    `,
    )
    .run(content, completed, deleted, priority, completedAt, deletedAt, ts, id)

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
  } else if (patch.priority !== undefined && priority !== current.priority) {
    recordOperation({
      action: 'todo.priority',
      targetType: 'todo',
      targetId: id,
      summary: `${content.slice(0, 60)} → ${priority ?? '未打标'}`,
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

/** 回收站「清除」：前端无痕，数据仍保留 */
export function purgeTodo(id: number): TodoRow | undefined {
  const current = getTodo(id)
  if (!current || current.hidden === 1) return undefined
  if (current.deleted !== 1) return undefined

  const ts = nowIso()
  getDb()
    .prepare(
      `
      UPDATE todos
      SET hidden = 1, hidden_at = ?, updated_at = ?
      WHERE id = ?
    `,
    )
    .run(ts, ts, id)

  recordOperation({
    action: 'todo.purge',
    targetType: 'todo',
    targetId: id,
    summary: current.content.slice(0, 80),
  })

  return getTodo(id)
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
