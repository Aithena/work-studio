import { apiGet } from './client'

export type ActivityDay = {
  day: string
  count: number
}

export type MonthOverview = {
  recordDays: number
  recordCount: number
  wordCount: number
}

export type OperationLogItem = {
  id: number
  day: string
  action: string
  targetType: string
  targetId: string | null
  summary: string
  weight: number
  chars: number
  createdAt: string
}

export function fetchActivity(days = 371) {
  return apiGet<{ days: ActivityDay[]; month: MonthOverview }>(`/api/activity?days=${days}`)
}

export function fetchActivityLogs(limit = 100) {
  return apiGet<{ items: OperationLogItem[] }>(`/api/activity/logs?limit=${limit}`)
}
