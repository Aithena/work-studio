import type { Context } from 'hono'
import { recordOperation } from './activity'
import { insertAiCall, updateAiCall } from './ai-logs'
import { nowIso, type WorkerEnv } from './env'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function parseSse(raw: string) {
  let model: string | null = null
  let finishReason: string | null = null
  let promptTokens: number | null = null
  let completionTokens: number | null = null
  let totalTokens: number | null = null
  let content = ''

  for (const block of raw.split(/\n\n/)) {
    const line = block.split('\n').find((item) => item.startsWith('data:'))
    if (!line) continue
    const data = line.slice(5).trim()
    if (!data || data === '[DONE]') continue
    try {
      const json = JSON.parse(data) as Record<string, unknown>
      if (typeof json.model === 'string' && json.model.trim()) model = json.model
      const usage = asRecord(json.usage)
      if (usage) {
        promptTokens = asNumber(usage.prompt_tokens) ?? promptTokens
        completionTokens = asNumber(usage.completion_tokens) ?? completionTokens
        totalTokens = asNumber(usage.total_tokens) ?? totalTokens
      }
      const choices = Array.isArray(json.choices) ? json.choices : []
      const choice = asRecord(choices[0])
      if (!choice) continue
      if (typeof choice.finish_reason === 'string') finishReason = choice.finish_reason
      const delta = asRecord(choice.delta)
      if (delta && typeof delta.content === 'string') content += delta.content
      const message = asRecord(choice.message)
      if (message && typeof message.content === 'string') content += message.content
    } catch {
      // skip
    }
  }

  return { model, finishReason, promptTokens, completionTokens, totalTokens, content }
}

function parseJsonBody(raw: string) {
  try {
    return asRecord(JSON.parse(raw))
  } catch {
    return null
  }
}

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let raw = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    raw += decoder.decode(value, { stream: true })
  }
  raw += decoder.decode()
  return raw
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return '{"error":"request_not_serializable"}'
  }
}

function buildArchivePayload(input: {
  createdAt: string
  started: number
  ok: boolean
  httpStatus?: number | null
  fallbackModel: string
  requestJson: string
  rawBody?: string
  contentType?: string | null
  errorMessage?: string | null
}) {
  const rawBody = input.rawBody ?? ''
  const parsedSse = input.contentType?.includes('text/event-stream') ? parseSse(rawBody) : null
  const parsedJson = parsedSse ? null : parseJsonBody(rawBody)
  const usage = parsedJson ? asRecord(parsedJson.usage) : null
  const errorObj = parsedJson ? asRecord(parsedJson.error) : null
  const ok = input.ok

  return {
    createdAt: input.createdAt,
    durationMs: Date.now() - input.started,
    status: (ok ? 'success' : 'error') as 'success' | 'error',
    httpStatus: input.httpStatus ?? null,
    model: parsedSse?.model || (typeof parsedJson?.model === 'string' ? parsedJson.model : input.fallbackModel),
    promptTokens: parsedSse?.promptTokens ?? asNumber(usage?.prompt_tokens),
    completionTokens: parsedSse?.completionTokens ?? asNumber(usage?.completion_tokens),
    totalTokens: parsedSse?.totalTokens ?? asNumber(usage?.total_tokens),
    finishReason: parsedSse?.finishReason ?? null,
    errorMessage: ok
      ? null
      : input.errorMessage ||
        (typeof errorObj?.message === 'string' && errorObj.message) ||
        rawBody.slice(0, 500) ||
        (input.httpStatus ? `HTTP ${input.httpStatus}` : '调用失败'),
    requestJson: input.requestJson,
    responseJson: rawBody
      ? JSON.stringify(
          parsedSse
            ? {
                model: parsedSse.model,
                usage: {
                  prompt_tokens: parsedSse.promptTokens,
                  completion_tokens: parsedSse.completionTokens,
                  total_tokens: parsedSse.totalTokens,
                },
                finish_reason: parsedSse.finishReason,
                content: parsedSse.content,
              }
            : parsedJson ?? { raw: rawBody },
        )
      : null,
    rawSse: rawBody || null,
  }
}

async function persistCall(
  db: D1Database,
  callId: number | null,
  input: Parameters<typeof buildArchivePayload>[0],
): Promise<number | null> {
  const payload = buildArchivePayload(input)
  try {
    if (callId != null) {
      await updateAiCall(db, callId, payload)
      return callId
    }
    return await insertAiCall(db, payload)
  } catch (error) {
    console.error('[ai] persist call log failed', error)
    return callId
  }
}

async function beginCallLog(
  db: D1Database,
  createdAt: string,
  model: string,
  requestJson: string,
): Promise<number | null> {
  try {
    return await insertAiCall(db, {
      createdAt,
      status: 'error',
      model,
      requestJson,
      errorMessage: '进行中',
    })
  } catch (error) {
    console.error('[ai] create call log failed', error)
    return null
  }
}

export async function proxyChatCompletions(
  c: Context<{ Bindings: WorkerEnv }>,
): Promise<Response> {
  const apiKey = c.env.AI_API_KEY?.trim()
  if (!apiKey) {
    return c.json({ success: false, message: '未配置 AI_API_KEY' }, 503)
  }

  const baseUrl = (c.env.AI_BASE_URL?.trim() || 'https://api.deepseek.com/v1').replace(/\/$/, '')
  const defaultModel = c.env.AI_MODEL?.trim() || 'deepseek-v4-flash'

  let raw: unknown
  try {
    raw = await c.req.json()
  } catch {
    return c.json({ success: false, message: '请求体不是合法 JSON' }, 400)
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return c.json({ success: false, message: '请求体不是合法 JSON' }, 400)
  }

  const body: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value == null) continue
    body[key] = value
  }

  const model = (typeof body.model === 'string' && body.model.trim()) || defaultModel
  body.model = model
  body.stream = true

  if (baseUrl.includes('deepseek') && body.thinking == null) {
    body.thinking = { type: 'disabled' }
  }

  const archivedRequest = { ...body }
  const prevOptions = asRecord(body.stream_options)
  body.stream_options = { ...(prevOptions ?? {}), include_usage: true }

  const createdAt = nowIso()
  const started = Date.now()
  const requestJson = safeJson(archivedRequest)
  const callId = await beginCallLog(c.env.DB, createdAt, model, requestJson)

  let upstream: Response
  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })
  } catch (error) {
    await persistCall(c.env.DB, callId, {
      createdAt,
      started,
      ok: false,
      fallbackModel: model,
      requestJson,
      errorMessage: error instanceof Error ? error.message : '上游请求失败',
    })
    return c.json({ success: false, message: '上游 AI 请求失败' }, 502)
  }

  if (upstream.ok) {
    try {
      await recordOperation(c.env.DB, {
        action: 'ai.chat',
        targetType: 'ai',
        summary: `AI 对话 · ${model}`,
      })
    } catch (error) {
      console.error('[ai] record operation failed', error)
    }
  }

  const headers = new Headers()
  const contentType = upstream.headers.get('Content-Type')
  if (contentType) headers.set('Content-Type', contentType)
  headers.set('Cache-Control', 'no-cache')

  if (!upstream.body) {
    await persistCall(c.env.DB, callId, {
      createdAt,
      started,
      ok: upstream.ok,
      httpStatus: upstream.status,
      fallbackModel: model,
      requestJson,
      contentType,
    })
    return new Response(null, { status: upstream.status, headers })
  }

  const [clientStream, archiveStream] = upstream.body.tee()
  c.executionCtx.waitUntil(
    readStream(archiveStream)
      .then((rawBody) =>
        persistCall(c.env.DB, callId, {
          createdAt,
          started,
          ok: upstream.ok,
          httpStatus: upstream.status,
          fallbackModel: model,
          requestJson,
          rawBody,
          contentType,
        }),
      )
      .catch((error) =>
        persistCall(c.env.DB, callId, {
          createdAt,
          started,
          ok: false,
          httpStatus: upstream.status,
          fallbackModel: model,
          requestJson,
          errorMessage: error instanceof Error ? error.message : '读取上游响应失败',
        }),
      ),
  )

  return new Response(clientStream, {
    status: upstream.status,
    headers,
  })
}
