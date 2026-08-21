export type TodoFilter = 'all' | 'active' | 'completed' | 'deleted'

export type TodoPriority = 'P0' | 'P1' | 'P2' | 'P3'

export type Todo = {
  id: number
  content: string
  completed: boolean
  deleted: boolean
  priority: TodoPriority | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export type TodoCounts = {
  active: number
  completed: number
  deleted: number
}

export type Note = {
  id: number
  content: string
  updatedAt: string
}

export type ApiSuccess<T> = {
  success: true
  data: T
}

export type ApiFail = {
  success: false
  message: string
}

export type SaveState = 'saved' | 'editing' | 'saving' | 'error'
