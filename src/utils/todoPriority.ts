import type { Todo, TodoPriority } from '../types'

export const TODO_PRIORITIES: TodoPriority[] = ['P0', 'P1', 'P2', 'P3']

/** 未完成区排序：P0 → P1 → P2 → 未打标 → P3 */
export function priorityRank(priority: TodoPriority | null | undefined): number {
  if (priority === 'P0') return 0
  if (priority === 'P1') return 1
  if (priority === 'P2') return 2
  if (priority === 'P3') return 4
  return 3
}

export function sortActiveTodos(list: Todo[]): Todo[] {
  return list.slice().sort((a, b) => {
    const byPriority = priorityRank(a.priority) - priorityRank(b.priority)
    if (byPriority !== 0) return byPriority
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return a.id - b.id
  })
}
