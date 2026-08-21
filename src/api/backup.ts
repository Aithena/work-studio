import { apiGet, apiSend } from './client'

export type BackupPayload = {
  version: 1
  exportedAt: string
  note: { content: string; updatedAt: string }
  todos: unknown[]
}

export function fetchExportBackup() {
  return apiGet<{ filename: string; payload: BackupPayload }>('/api/backup/export')
}

export function importBackup(payload: unknown) {
  return apiSend<{ todoCount: number }>('/api/backup/import', 'POST', payload)
}
