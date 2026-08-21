import type { Context } from 'hono'
import { recordOperation } from './activity'

function env(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback
}

export async function proxyChatCompletions(c: Context): Promise<Response> {
  const apiKey = env('AI_API_KEY')
  if (!apiKey) {
    return c.json({ success: false, message: '未配置 AI_API_KEY' }, 503)
  }

  const baseUrl = env('AI_BASE_URL', 'https://api.deepseek.com/v1').replace(/\/$/, '')
  const defaultModel = env('AI_MODEL', 'deepseek-v4-flash')

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

  const model =
    (typeof body.model === 'string' && body.model.trim()) || defaultModel
  body.model = model
  body.stream = true

  if (baseUrl.includes('deepseek') && body.thinking == null) {
    body.thinking = { type: 'disabled' }
  }

  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (upstream.ok) {
    recordOperation({
      action: 'ai.chat',
      targetType: 'ai',
      summary: `AI 对话 · ${model}`,
    })
  }

  const headers = new Headers()
  const contentType = upstream.headers.get('Content-Type')
  if (contentType) headers.set('Content-Type', contentType)
  headers.set('Cache-Control', 'no-cache')

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  })
}
