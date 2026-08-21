import { apiGet, apiSend } from './client'
import type { Note } from '../types'

export function fetchNote() {
  return apiGet<Note>('/api/note')
}

export function saveNote(content: string) {
  return apiSend<Note>('/api/note', 'PUT', { content })
}
