import { apiGet, apiSend } from './client'

export type BackupImage = {
  mime: string
  data: string
}

export type BackupPayload = {
  version: 1 | 2
  exportedAt: string
  note: { content: string; updatedAt: string }
  todos: unknown[]
  images?: Record<string, BackupImage>
}

export function fetchExportBackup() {
  return apiGet<{ filename: string; payload: BackupPayload }>('/api/backup/export')
}

export function importBackup(payload: unknown) {
  return apiSend<{ todoCount: number; imageCount: number }>('/api/backup/import', 'POST', payload)
}
