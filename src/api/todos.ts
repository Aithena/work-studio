import { apiGet, apiSend } from './client'
import type { Todo, TodoCounts, TodoFilter } from '../types'

export function fetchTodos(filter: TodoFilter) {
  return apiGet<{ items: Todo[]; counts: TodoCounts }>(`/api/todos?filter=${filter}`)
}

export function createTodo(content: string) {
  return apiSend<Todo>('/api/todos', 'POST', { content })
}

export function updateTodo(
  id: number,
  patch: { content?: string; completed?: boolean; deleted?: boolean },
) {
  return apiSend<Todo>(`/api/todos/${id}`, 'PUT', patch)
}

export function deleteTodo(id: number) {
  return apiSend<Todo>(`/api/todos/${id}`, 'DELETE')
}

export function importTodos(text: string) {
  return apiSend<{ items: Todo[]; counts: TodoCounts }>('/api/todos/import', 'POST', { text })
}

export function reorderTodos(ids: number[]) {
  return apiSend<{ ok: true }>('/api/todos/reorder', 'PUT', { ids })
}
