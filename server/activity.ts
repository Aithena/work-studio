import { getDb, nowIso } from './db'

export type ActivityDay = {
  day: string
  count: number
}

export type MonthOverview = {
  recordDays: number
  recordCount: number
  wordCount: number
}

export type OperationLogRow = {
  id: number
  day: string
  action: OperationAction
  targetType: string
  targetId: string | null
  summary: string
  weight: number
  chars: number
  createdAt: string
}

export type OperationAction =
  | 'todo.create'
  | 'todo.import'
  | 'todo.update'
  | 'todo.complete'
  | 'todo.uncomplete'
  | 'todo.delete'
  | 'todo.restore'
  | 'note.save'
  | 'ai.chat'

export function todayKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function recordOperation(input: {
  action: OperationAction
  targetType: 'todo' | 'note' | 'ai'
  targetId?: string | number | null
  summary?: string
  weight?: number
  chars?: number
}): void {
  const weight = Math.max(1, Math.floor(input.weight ?? 1))
  const chars = Math.max(0, Math.floor(input.chars ?? 0))
  const createdAt = nowIso()
  getDb()
    .prepare(
      `
      INSERT INTO operation_logs (day, action, target_type, target_id, summary, weight, chars, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      todayKey(),
      input.action,
      input.targetType,
      input.targetId == null ? null : String(input.targetId),
      input.summary?.trim() || '',
      weight,
      chars,
      createdAt,
    )
}

export function listActivity(days = 371): ActivityDay[] {
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))
  const startKey = todayKey(start)

  const rows = getDb()
    .prepare(
      `
      SELECT day, COALESCE(SUM(weight), 0) AS count
      FROM operation_logs
      WHERE day >= ?
      GROUP BY day
      ORDER BY day ASC
    `,
    )
    .all(startKey) as ActivityDay[]

  const map = new Map(rows.map((row) => [row.day, Number(row.count) || 0]))
  const result: ActivityDay[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    const key = todayKey(cursor)
    result.push({ day: key, count: map.get(key) ?? 0 })
    cursor.setDate(cursor.getDate() + 1)
  }
  return result
}

export function getMonthOverview(date = new Date()): MonthOverview {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  const startKey = todayKey(start)
  const endKey = todayKey(end)

  const row = getDb()
    .prepare(
      `
      SELECT
        COUNT(DISTINCT day) AS record_days,
        COALESCE(SUM(weight), 0) AS record_count,
        COALESCE(SUM(chars), 0) AS word_count
      FROM operation_logs
      WHERE day >= ? AND day <= ?
    `,
    )
    .get(startKey, endKey) as {
    record_days: number | null
    record_count: number | null
    word_count: number | null
  }

  return {
    recordDays: Number(row.record_days) || 0,
    recordCount: Number(row.record_count) || 0,
    wordCount: Number(row.word_count) || 0,
  }
}

export function listOperationLogs(limit = 100): OperationLogRow[] {
  const size = Math.min(Math.max(Math.floor(limit), 1), 500)
  const rows = getDb()
    .prepare(
      `
      SELECT id, day, action, target_type, target_id, summary, weight, chars, created_at
      FROM operation_logs
      ORDER BY id DESC
      LIMIT ?
    `,
    )
    .all(size) as Array<{
    id: number
    day: string
    action: OperationAction
    target_type: string
    target_id: string | null
    summary: string
    weight: number
    chars: number
    created_at: string
  }>

  return rows.map((row) => ({
    id: row.id,
    day: row.day,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    summary: row.summary,
    weight: row.weight,
    chars: row.chars,
    createdAt: row.created_at,
  }))
}
