export type TodoFilter = 'all' | 'active' | 'completed' | 'deleted'

export type Todo = {
  id: number
  content: string
  completed: boolean
  deleted: boolean
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
