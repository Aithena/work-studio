import { recordOperation } from './activity'
import { nowIso, type TodoCounts, type TodoPriority, type TodoRow } from './env'

export type TodoFilter = 'all' | 'active' | 'completed' | 'deleted'

const MS_DAY = 24 * 60 * 60 * 1000
const COMPLETED_TO_TRASH_DAYS = 7
const TRASH_TO_HIDDEN_DAYS = 30

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

export async function runTodoLifecycle(db: D1Database): Promise<void> {
  const now = Date.now()
  const ts = nowIso()

  const completed = await db
    .prepare(
      `
      SELECT id, completed_at, updated_at
      FROM todos
      WHERE hidden = 0 AND deleted = 0 AND completed = 1
    `,
    )
    .all<{ id: number; completed_at: string | null; updated_at: string }>()

  const toTrash = (completed.results ?? []).filter((row) => {
    const base = parseTs(row.completed_at) ?? parseTs(row.updated_at)
    if (base == null) return false
    return now - base >= COMPLETED_TO_TRASH_DAYS * MS_DAY
  })

  if (toTrash.length) {
    const stmts = toTrash.map((row) =>
      db
        .prepare(
          `
          UPDATE todos
          SET deleted = 1, deleted_at = ?, updated_at = ?
          WHERE id = ?
        `,
        )
        .bind(ts, ts, row.id),
    )
    await db.batch(stmts)
  }

  const trash = await db
    .prepare(
      `
      SELECT id, deleted_at, updated_at
      FROM todos
      WHERE hidden = 0 AND deleted = 1
    `,
    )
    .all<{ id: number; deleted_at: string | null; updated_at: string }>()

  const toHidden = (trash.results ?? []).filter((row) => {
    const base = parseTs(row.deleted_at) ?? parseTs(row.updated_at)
    if (base == null) return false
    return now - base >= TRASH_TO_HIDDEN_DAYS * MS_DAY
  })

  if (toHidden.length) {
    const stmts = toHidden.map((row) =>
      db
        .prepare(
          `
          UPDATE todos
          SET hidden = 1, hidden_at = ?, updated_at = ?
          WHERE id = ?
        `,
        )
        .bind(ts, ts, row.id),
    )
    await db.batch(stmts)
  }
}

export async function getCounts(db: D1Database): Promise<TodoCounts> {
  await runTodoLifecycle(db)
  const row = await db
    .prepare(
      `
      SELECT
        SUM(CASE WHEN hidden = 0 AND deleted = 0 AND completed = 0 THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN hidden = 0 AND deleted = 0 AND completed = 1 THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN hidden = 0 AND deleted = 1 THEN 1 ELSE 0 END) AS deleted
      FROM todos
    `,
    )
    .first<{ active: number | null; completed: number | null; deleted: number | null }>()

  return {
    active: row?.active ?? 0,
    completed: row?.completed ?? 0,
    deleted: row?.deleted ?? 0,
  }
}

export async function listTodos(db: D1Database, filter: TodoFilter): Promise<TodoRow[]> {
  await runTodoLifecycle(db)

  if (filter === 'deleted') {
    const { results } = await db
      .prepare(
        `
        SELECT * FROM todos
        WHERE hidden = 0 AND deleted = 1
        ORDER BY COALESCE(deleted_at, updated_at) DESC, id DESC
      `,
      )
      .all<TodoRow>()
    return results ?? []
  }

  if (filter === 'active') {
    const { results } = await db
      .prepare(
        `
        SELECT * FROM todos
        WHERE hidden = 0 AND deleted = 0 AND completed = 0
        ORDER BY ${ACTIVE_PRIORITY_ORDER} ASC, sort_order ASC, id ASC
      `,
      )
      .all<TodoRow>()
    return results ?? []
  }

  if (filter === 'completed') {
    const { results } = await db
      .prepare(
        `
        SELECT * FROM todos
        WHERE hidden = 0 AND deleted = 0 AND completed = 1
        ORDER BY sort_order ASC, id ASC
      `,
      )
      .all<TodoRow>()
    return results ?? []
  }

  const { results } = await db
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
    .all<TodoRow>()
  return results ?? []
}

export async function getTodo(db: D1Database, id: number): Promise<TodoRow | undefined> {
  const row = await db.prepare('SELECT * FROM todos WHERE id = ?').bind(id).first<TodoRow>()
  return row ?? undefined
}

async function nextActiveSortOrder(db: D1Database): Promise<number> {
  const row = await db
    .prepare(
      `
      SELECT MIN(sort_order) AS min_sort
      FROM todos
      WHERE hidden = 0 AND deleted = 0 AND completed = 0
    `,
    )
    .first<{ min_sort: number | null }>()

  if (row?.min_sort == null) return 0
  return row.min_sort - 1
}

async function insertTodo(db: D1Database, content: string): Promise<TodoRow> {
  const ts = nowIso()
  const sortOrder = await nextActiveSortOrder(db)
  const result = await db
    .prepare(
      `
      INSERT INTO todos (
        content, completed, deleted, hidden, priority, sort_order,
        created_at, updated_at, completed_at, deleted_at, hidden_at
      )
      VALUES (?, 0, 0, 0, NULL, ?, ?, ?, NULL, NULL, NULL)
    `,
    )
    .bind(content, sortOrder, ts, ts)
    .run()

  const id = Number(result.meta.last_row_id)
  const row = await getTodo(db, id)
  if (!row) throw new Error('failed to create todo')
  return row
}

export async function createTodo(db: D1Database, content: string): Promise<TodoRow> {
  const row = await insertTodo(db, content)
  await recordOperation(db, {
    action: 'todo.create',
    targetType: 'todo',
    targetId: row.id,
    summary: content.slice(0, 80),
  })
  return row
}

export async function createTodos(db: D1Database, contents: string[]): Promise<TodoRow[]> {
  const created: TodoRow[] = []
  for (let i = contents.length - 1; i >= 0; i -= 1) {
    created.unshift(await insertTodo(db, contents[i]))
  }

  await recordOperation(db, {
    action: 'todo.import',
    targetType: 'todo',
    summary: `导入 ${created.length} 条任务`,
    weight: created.length,
  })

  return created
}

export async function updateTodo(
  db: D1Database,
  id: number,
  patch: {
    content?: string
    completed?: boolean
    deleted?: boolean
    priority?: TodoPriority | null
  },
): Promise<TodoRow | undefined> {
  const current = await getTodo(db, id)
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

  await db
    .prepare(
      `
      UPDATE todos
      SET content = ?, completed = ?, deleted = ?, priority = ?,
          completed_at = ?, deleted_at = ?, updated_at = ?
      WHERE id = ?
    `,
    )
    .bind(content, completed, deleted, priority, completedAt, deletedAt, ts, id)
    .run()

  if (patch.deleted != null && deleted !== current.deleted) {
    await recordOperation(db, {
      action: deleted ? 'todo.delete' : 'todo.restore',
      targetType: 'todo',
      targetId: id,
      summary: content.slice(0, 80),
    })
  } else if (patch.completed != null && completed !== current.completed) {
    await recordOperation(db, {
      action: completed ? 'todo.complete' : 'todo.uncomplete',
      targetType: 'todo',
      targetId: id,
      summary: content.slice(0, 80),
    })
  } else if (patch.priority !== undefined && priority !== current.priority) {
    await recordOperation(db, {
      action: 'todo.priority',
      targetType: 'todo',
      targetId: id,
      summary: `${content.slice(0, 60)} → ${priority ?? '未打标'}`,
    })
  } else if (patch.content != null && content !== current.content) {
    await recordOperation(db, {
      action: 'todo.update',
      targetType: 'todo',
      targetId: id,
      summary: content.slice(0, 80),
    })
  }

  return getTodo(db, id)
}

export async function softDeleteTodo(db: D1Database, id: number): Promise<TodoRow | undefined> {
  return updateTodo(db, id, { deleted: true })
}

export async function purgeTodo(db: D1Database, id: number): Promise<TodoRow | undefined> {
  const current = await getTodo(db, id)
  if (!current || current.hidden === 1) return undefined
  if (current.deleted !== 1) return undefined

  const ts = nowIso()
  await db
    .prepare(
      `
      UPDATE todos
      SET hidden = 1, hidden_at = ?, updated_at = ?
      WHERE id = ?
    `,
    )
    .bind(ts, ts, id)
    .run()

  await recordOperation(db, {
    action: 'todo.purge',
    targetType: 'todo',
    targetId: id,
    summary: current.content.slice(0, 80),
  })

  return getTodo(db, id)
}

export async function reorderTodos(db: D1Database, ids: number[]): Promise<void> {
  const ts = nowIso()
  const stmts = ids.map((todoId, index) =>
    db.prepare('UPDATE todos SET sort_order = ?, updated_at = ? WHERE id = ?').bind(index, ts, todoId),
  )
  if (stmts.length) await db.batch(stmts)
}
