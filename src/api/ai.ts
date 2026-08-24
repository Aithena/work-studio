import { apiGet } from './client'

export type AiCallItem = {
  id: number
  createdAt: string
  finishedAt: string | null
  durationMs: number | null
  status: 'success' | 'error'
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

export function fetchAiCalls(limit = 100) {
  return apiGet<{ items: AiCallItem[] }>(`/api/ai/calls?limit=${limit}`)
}

export function fetchAiCall(id: number) {
  return apiGet<AiCallItem>(`/api/ai/calls/${id}`)
}
