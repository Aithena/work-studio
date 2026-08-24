import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createTodo as apiCreate,
  deleteTodo as apiDelete,
  fetchTodos,
  importTodos as apiImport,
  purgeTodo as apiPurge,
  reorderTodos as apiReorder,
  updateTodo as apiUpdate,
} from '../api/todos'
import type { Todo, TodoCounts, TodoFilter, TodoPriority } from '../types'
import { sortActiveTodos } from '../utils/todoPriority'

const todos = ref<Todo[]>([])
const counts = ref<TodoCounts>({ active: 0, completed: 0, deleted: 0 })
const filter = ref<TodoFilter>('active')
const loading = ref(false)
const searchQuery = ref('')

function replaceTodo(next: Todo) {
  const index = todos.value.findIndex((item) => item.id === next.id)
  if (index === -1) todos.value.unshift(next)
  else todos.value[index] = next
}

function removeFromList(id: number) {
  todos.value = todos.value.filter((item) => item.id !== id)
}

function notifyActivity() {
  window.dispatchEvent(new Event('workbench:activity'))
}

function matchesSearch(todo: Todo) {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return true
  return todo.content.toLowerCase().includes(q)
}

async function refreshCountsFrom(next?: TodoCounts) {
  if (next) {
    counts.value = next
    return
  }
  try {
    const data = await fetchTodos(filter.value)
    counts.value = data.counts
  } catch {
    // keep previous counts
  }
}

export function useTodos() {
  const activeTodos = computed(() =>
    sortActiveTodos(
      todos.value.filter((item) => !item.completed && !item.deleted && matchesSearch(item)),
    ),
  )
  // 已完成区不按标签排序，保持 sort_order
  const completedTodos = computed(() =>
    todos.value
      .filter((item) => item.completed && !item.deleted && matchesSearch(item))
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
  )
  const deletedTodos = computed(() =>
    todos.value.filter((item) => item.deleted && matchesSearch(item)),
  )

  function setSearchQuery(value: string) {
    searchQuery.value = value
  }

  function clearSearch() {
    searchQuery.value = ''
  }

  async function load() {
    loading.value = true
    try {
      const data = await fetchTodos(filter.value)
      todos.value = data.items
      counts.value = data.counts
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '加载 Todo 失败')
    } finally {
      loading.value = false
    }
  }

  async function setFilter(next: TodoFilter) {
    filter.value = next
    await load()
  }

  async function addTodo(content: string) {
    const text = content.trim()
    if (!text) return
    try {
      const created = await apiCreate(text)
      if (filter.value === 'completed' || filter.value === 'deleted') {
        filter.value = 'active'
        await load()
        return
      }
      todos.value = [created, ...todos.value.filter((item) => item.id !== created.id)]
      await refreshCountsFrom()
      notifyActivity()
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '添加失败')
    }
  }

  async function importText(text: string) {
    const created = await apiImport(text)
    if (filter.value === 'completed' || filter.value === 'deleted') {
      filter.value = 'active'
    }
    await load()
    notifyActivity()
    return created.items.length
  }

  async function toggleTodo(todo: Todo) {
    if (todo.deleted) return
    const snapshot = { ...todo }
    const next = { ...todo, completed: !todo.completed }
    replaceTodo(next)
    try {
      const saved = await apiUpdate(todo.id, { completed: next.completed })
      replaceTodo(saved)
      if (filter.value === 'active' && saved.completed) removeFromList(saved.id)
      if (filter.value === 'completed' && !saved.completed) removeFromList(saved.id)
      await refreshCountsFrom()
      notifyActivity()
    } catch (error) {
      replaceTodo(snapshot)
      ElMessage.error(error instanceof Error ? error.message : '更新失败')
    }
  }

  async function editTodo(todo: Todo, content: string) {
    const text = content.trim()
    if (!text || text === todo.content) return
    const snapshot = { ...todo }
    replaceTodo({ ...todo, content: text })
    try {
      const saved = await apiUpdate(todo.id, { content: text })
      replaceTodo(saved)
      notifyActivity()
    } catch (error) {
      replaceTodo(snapshot)
      ElMessage.error(error instanceof Error ? error.message : '编辑失败')
    }
  }

  async function setPriority(todo: Todo, priority: TodoPriority | null) {
    if (todo.deleted) return
    if (todo.priority === priority) return
    const snapshot = { ...todo }
    replaceTodo({ ...todo, priority })
    try {
      const saved = await apiUpdate(todo.id, { priority })
      replaceTodo(saved)
      notifyActivity()
    } catch (error) {
      replaceTodo(snapshot)
      ElMessage.error(error instanceof Error ? error.message : '设置优先级失败')
    }
  }

  async function confirmDelete(todo: Todo) {
    if (todo.deleted) return
    try {
      await ElMessageBox.confirm(`“${todo.content}”将移动到回收站。`, '确认删除？', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'wb-message-box',
      })
    } catch {
      return
    }

    const snapshot = todos.value.slice()
    const snapshotCounts = { ...counts.value }
    removeFromList(todo.id)
    counts.value = {
      ...counts.value,
      active: todo.completed ? counts.value.active : Math.max(0, counts.value.active - 1),
      completed: todo.completed ? Math.max(0, counts.value.completed - 1) : counts.value.completed,
      deleted: counts.value.deleted + 1,
    }
    try {
      await apiDelete(todo.id)
      notifyActivity()
    } catch (error) {
      todos.value = snapshot
      counts.value = snapshotCounts
      ElMessage.error(error instanceof Error ? error.message : '删除失败')
    }
  }

  async function confirmPurge(todo: Todo) {
    if (!todo.deleted) return
    try {
      await ElMessageBox.confirm(
        `“${todo.content}”将从回收站清除，界面不再显示。`,
        '确认清除？',
        {
          confirmButtonText: '清除',
          cancelButtonText: '取消',
          type: 'warning',
          customClass: 'wb-message-box',
        },
      )
    } catch {
      return
    }

    const snapshot = todos.value.slice()
    const snapshotCounts = { ...counts.value }
    removeFromList(todo.id)
    counts.value = {
      ...counts.value,
      deleted: Math.max(0, counts.value.deleted - 1),
    }
    try {
      await apiPurge(todo.id)
      notifyActivity()
    } catch (error) {
      todos.value = snapshot
      counts.value = snapshotCounts
      ElMessage.error(error instanceof Error ? error.message : '清除失败')
    }
  }

  async function restoreTodo(todo: Todo) {
    const snapshot = todos.value.slice()
    removeFromList(todo.id)
    try {
      await apiUpdate(todo.id, { deleted: false })
      await load()
      notifyActivity()
    } catch (error) {
      todos.value = snapshot
      ElMessage.error(error instanceof Error ? error.message : '恢复失败')
    }
  }

  async function moveToTop(todo: Todo) {
    if (todo.deleted || todo.completed) return
    const rest = activeTodos.value.filter((item) => item.id !== todo.id)
    const nextActive = reconcileActiveOrder([todo, ...rest])
    await persistGroupOrder(nextActive, completedTodos.value)
  }

  /** 拖拽后：组内保留相对顺序，组间仍按 P0→P1→P2→未打标→P3 */
  function reconcileActiveOrder(dragged: Todo[]): Todo[] {
    const buckets: Record<'P0' | 'P1' | 'P2' | 'none' | 'P3', Todo[]> = {
      P0: [],
      P1: [],
      P2: [],
      none: [],
      P3: [],
    }
    for (const item of dragged) {
      if (item.priority === 'P0' || item.priority === 'P1' || item.priority === 'P2' || item.priority === 'P3') {
        buckets[item.priority].push(item)
      } else {
        buckets.none.push(item)
      }
    }
    return [...buckets.P0, ...buckets.P1, ...buckets.P2, ...buckets.none, ...buckets.P3]
  }

  async function persistGroupOrder(active: Todo[], completed: Todo[]) {
    const previous = todos.value.slice()
    const deleted = todos.value.filter((item) => item.deleted)
    const orderedActive = reconcileActiveOrder(active).map((item, index) => ({
      ...item,
      sortOrder: index,
    }))
    const orderedCompleted = completed.map((item, index) => ({
      ...item,
      sortOrder: orderedActive.length + index,
    }))
    if (filter.value === 'all') {
      todos.value = [...orderedActive, ...orderedCompleted, ...deleted]
    } else if (filter.value === 'active') {
      todos.value = orderedActive
    } else if (filter.value === 'completed') {
      todos.value = orderedCompleted
    }
    try {
      await apiReorder([...orderedActive, ...orderedCompleted].map((item) => item.id))
    } catch (error) {
      todos.value = previous
      ElMessage.error(error instanceof Error ? error.message : '排序失败')
    }
  }

  return {
    todos,
    counts,
    filter,
    loading,
    searchQuery,
    activeTodos,
    completedTodos,
    deletedTodos,
    load,
    setFilter,
    setSearchQuery,
    clearSearch,
    addTodo,
    importText,
    toggleTodo,
    editTodo,
    setPriority,
    confirmDelete,
    confirmPurge,
    restoreTodo,
    moveToTop,
    persistGroupOrder,
  }
}
