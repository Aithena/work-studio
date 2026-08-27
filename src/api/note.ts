import { apiGet, apiSend } from './client'
import type { Note, NoteMeta } from '../types'

export function fetchNotes() {
  return apiGet<{ items: NoteMeta[] }>('/api/notes')
}

export function fetchNote(id?: number) {
  const query = id != null ? `?id=${id}` : ''
  return apiGet<Note>(`/api/note${query}`)
}

export function saveNote(content: string, id?: number) {
  return apiSend<Note>('/api/note', 'PUT', { content, id })
}

export function createNote(title: string) {
  return apiSend<Note>('/api/notes', 'POST', { title })
}

export function updateNote(id: number, patch: { title?: string; disabled?: boolean }) {
  return apiSend<NoteMeta>(`/api/notes/${id}`, 'PUT', patch)
}

export function reorderNotes(ids: number[]) {
  return apiSend<{ ok: true }>('/api/notes/reorder', 'PUT', { ids })
}

export function deleteNote(id: number) {
  return apiSend<NoteMeta>(`/api/notes/${id}`, 'DELETE')
}
