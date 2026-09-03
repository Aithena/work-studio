import { nowIso } from './env'

export type AiCallStatus = 'success' | 'error'

export type AiCallRow = {
  id: number
  createdAt: string
  finishedAt: string | null
  durationMs: number | null
  status: AiCallStatus
  httpStatus: number | null
  model: string | null
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
  finishReason: string | null
  errorMessage: string | null
  requestJson: string
  responseJson: string | null
  rawSse: string | null
  preview: string
}

export type AiCallInsert = {
  createdAt: string
  finishedAt?: string | null
  durationMs?: number | null
  status: AiCallStatus
  httpStatus?: number | null
  model?: string | null
  promptTokens?: number | null
  completionTokens?: number | null
  totalTokens?: number | null
  finishReason?: string | null
  errorMessage?: string | null
  requestJson: string
  responseJson?: string | null
  rawSse?: string | null
}

type DbAiCall = {
  id: number
  created_at: string
  finished_at: string | null
  duration_ms: number | null
  status: AiCallStatus
  http_status: number | null
  model: string | null
  prompt_tokens: number | null
  completion_tokens: number | null
  total_tokens: number | null
  finish_reason: string | null
  error_message: string | null
  request_json: string
  response_json: string | null
  raw_sse: string | null
}

function previewFromRequest(requestJson: string): string {
  try {
    const body = JSON.parse(requestJson) as { messages?: unknown }
    if (!Array.isArray(body.messages)) return ''
    const messages = [...body.messages].reverse()
    for (const item of messages) {
      if (!item || typeof item !== 'object') continue
      const row = item as { role?: unknown; content?: unknown }
      if (row.role !== 'user') continue
      if (typeof row.content === 'string') {
        return row.content.replace(/\s+/g, ' ').trim().slice(0, 120)
      }
      if (Array.isArray(row.content)) {
        const text = row.content
          .map((part) => {
            if (typeof part === 'string') return part
            if (part && typeof part === 'object' && 'text' in part) {
              const value = (part as { text?: unknown }).text
              return typeof value === 'string' ? value : ''
            }
            return ''
          })
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
        if (text) return text.slice(0, 120)
      }
    }
  } catch {
    // ignore
  }
  return ''
}

function mapRow(row: DbAiCall, includeRaw: boolean): AiCallRow {
  return {
    id: row.id,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms,
    status: row.status,
    httpStatus: row.http_status,
    model: row.model,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    totalTokens: row.total_tokens,
    finishReason: row.finish_reason,
    errorMessage: row.error_message,
    requestJson: row.request_json,
    responseJson: row.response_json,
    rawSse: includeRaw ? row.raw_sse : null,
    preview: previewFromRequest(row.request_json),
  }
}

export async function insertAiCall(db: D1Database, input: AiCallInsert): Promise<number> {
  const finishedAt = input.finishedAt ?? nowIso()
  const result = await db
    .prepare(
      `
      INSERT INTO ai_calls (
        created_at, finished_at, duration_ms, status, http_status, model,
        prompt_tokens, completion_tokens, total_tokens, finish_reason, error_message,
        request_json, response_json, raw_sse
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .bind(
      input.createdAt,
      finishedAt,
      input.durationMs ?? null,
      input.status,
      input.httpStatus ?? null,
      input.model ?? null,
      input.promptTokens ?? null,
      input.completionTokens ?? null,
      input.totalTokens ?? null,
      input.finishReason ?? null,
      input.errorMessage ?? null,
      input.requestJson,
      input.responseJson ?? null,
      input.rawSse ?? null,
    )
    .run()
  return Number(result.meta.last_row_id)
}

export async function updateAiCall(
  db: D1Database,
  id: number,
  patch: Omit<AiCallInsert, 'createdAt' | 'requestJson'> & {
    requestJson?: string
  },
): Promise<void> {
  await db
    .prepare(
      `
      UPDATE ai_calls SET
        finished_at = ?,
        duration_ms = ?,
        status = ?,
        http_status = ?,
        model = ?,
        prompt_tokens = ?,
        completion_tokens = ?,
        total_tokens = ?,
        finish_reason = ?,
        error_message = ?,
        response_json = ?,
        raw_sse = ?
      WHERE id = ?
    `,
    )
    .bind(
      patch.finishedAt ?? nowIso(),
      patch.durationMs ?? null,
      patch.status,
      patch.httpStatus ?? null,
      patch.model ?? null,
      patch.promptTokens ?? null,
      patch.completionTokens ?? null,
      patch.totalTokens ?? null,
      patch.finishReason ?? null,
      patch.errorMessage ?? null,
      patch.responseJson ?? null,
      patch.rawSse ?? null,
      id,
    )
    .run()
}

export async function listAiCalls(db: D1Database, limit = 100): Promise<AiCallRow[]> {
  const size = Math.min(Math.max(Math.floor(limit), 1), 500)
  const { results } = await db
    .prepare(
      `
      SELECT
        id, created_at, finished_at, duration_ms, status, http_status, model,
        prompt_tokens, completion_tokens, total_tokens, finish_reason, error_message,
        request_json, response_json, raw_sse
      FROM ai_calls
      ORDER BY id DESC
      LIMIT ?
    `,
    )
    .bind(size)
    .all<DbAiCall>()
  return (results ?? []).map((row) => mapRow(row, false))
}

export async function getAiCall(db: D1Database, id: number): Promise<AiCallRow | null> {
  const row = await db
    .prepare(
      `
      SELECT
        id, created_at, finished_at, duration_ms, status, http_status, model,
        prompt_tokens, completion_tokens, total_tokens, finish_reason, error_message,
        request_json, response_json, raw_sse
      FROM ai_calls
      WHERE id = ?
    `,
    )
    .bind(id)
    .first<DbAiCall>()
  return row ? mapRow(row, true) : null
}
