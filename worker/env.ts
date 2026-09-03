export type WorkerEnv = {
  DB: D1Database
  UPLOADS: R2Bucket
  ASSETS: Fetcher
  ACCESS_TOKEN?: string
  AI_API_KEY?: string
  AI_BASE_URL?: string
  AI_MODEL?: string
}

export type TodoPriority = 'P0' | 'P1' | 'P2' | 'P3'

export type TodoRow = {
  id: number
  content: string
  completed: number
  deleted: number
  hidden: number
  priority: TodoPriority | null
  sort_order: number
  created_at: string
  updated_at: string
  completed_at: string | null
  deleted_at: string | null
  hidden_at: string | null
}

export type NoteRow = {
  id: number
  title: string
  content: string
  disabled: number
  sort_order: number
  created_at: string
  updated_at: string
}

export type TodoCounts = {
  active: number
  completed: number
  deleted: number
}

export function nowIso(): string {
  return new Date().toISOString()
}
