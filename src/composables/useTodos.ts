import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createTodo as apiCreate,
  deleteTodo as apiDelete,
  fetchTodos,
  importTodos as apiImport,
  reorderTodos as apiReorder,
  updateTodo as apiUpdate,
} from '../api/todos'
import type { Todo, TodoCounts, TodoFilter } from '../types'

const todos = ref<Todo[]>([])
const counts = ref<TodoCounts>({ active: 0, completed: 0, deleted: 0 })
const filter = ref<TodoFilter>('all')
const loading = ref(false)

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
  const activeTodos = computed(() => todos.value.filter((item) => !item.completed && !item.deleted))
  const completedTodos = computed(() =>
    todos.value.filter((item) => item.completed && !item.deleted),
  )
  const deletedTodos = computed(() => todos.value.filter((item) => item.deleted))

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
        filter.value = 'all'
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
      filter.value = 'all'
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

  async function confirmDelete(todo: Todo) {
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
    const nextActive = [todo, ...rest]
    await persistGroupOrder(nextActive, completedTodos.value)
  }

  async function persistGroupOrder(active: Todo[], completed: Todo[]) {
    const previous = todos.value.slice()
    const deleted = todos.value.filter((item) => item.deleted)
    if (filter.value === 'all') {
      todos.value = [...active, ...completed, ...deleted]
    } else if (filter.value === 'active') {
      todos.value = active
    } else if (filter.value === 'completed') {
      todos.value = completed
    }
    try {
      await apiReorder([...active, ...completed].map((item) => item.id))
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
    activeTodos,
    completedTodos,
    deletedTodos,
    load,
    setFilter,
    addTodo,
    importText,
    toggleTodo,
    editTodo,
    confirmDelete,
    restoreTodo,
    moveToTop,
    persistGroupOrder,
  }
}
