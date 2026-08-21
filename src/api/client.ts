import type { ApiFail, ApiSuccess } from '../types'

async function parse<T>(res: Response): Promise<T> {
  let payload: ApiSuccess<T> | ApiFail
  try {
    payload = (await res.json()) as ApiSuccess<T> | ApiFail
  } catch {
    throw new Error(res.ok ? '响应无法解析' : `请求失败（${res.status}）`)
  }

  if (!payload.success) {
    throw new Error(payload.message || '请求失败')
  }
  return payload.data
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url)
  return parse<T>(res)
}

export async function apiSend<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body),
  })
  return parse<T>(res)
}
