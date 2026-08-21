<template>
  <section class="todo-panel">
    <div class="head">
      <div class="title-row">
        <h1>需要做的事情</h1>
        <span class="badge">{{ counts.active }}</span>
      </div>
      <div class="head-actions">
        <button class="import-btn" type="button" @click="importOpen = true">导入</button>
        <button class="add-btn" type="button" aria-label="添加" @click="startAdd">＋</button>
      </div>
    </div>

    <div class="body">
      <div v-if="adding" class="composer">
        <span class="check-placeholder" />
        <input
          ref="addInputRef"
          v-model="draft"
          placeholder="要做的事情"
          @keydown.enter.prevent="submitAdd"
          @keydown.esc.prevent="cancelAdd"
          @blur="submitAdd"
        />
      </div>

      <div v-if="isEmpty && !adding" class="empty">
        <span class="empty-circle" />
        <p>{{ emptyText }}</p>
        <button v-if="filter !== 'deleted'" type="button" @click="startAdd">＋ 添加第一件事</button>
      </div>

      <template v-else>
        <template v-if="filter === 'deleted'">
          <TodoItem
            v-for="todo in deletedTodos"
            :key="todo.id"
            :todo="todo"
            :editing="editingId === todo.id"
            @check="restoreTodo(todo)"
            @edit="editingId = todo.id"
            @menu="openMenu($event, todo)"
            @save="onSave(todo, $event)"
            @cancel-edit="editingId = null"
          />
        </template>

        <template v-else>
          <div v-if="showActiveHeader" class="section-label">未完成 · {{ activeTodos.length }}</div>
          <draggable
            v-if="filter !== 'completed'"
            :model-value="activeTodos"
            item-key="id"
            handle=".drag-handle"
            :animation="180"
            ghost-class="drag-ghost"
            @update:model-value="onActiveReorder"
          >
            <template #item="{ element }">
              <TodoItem
                :todo="element"
                :editing="editingId === element.id"
                @check="toggleTodo(element)"
                @edit="editingId = element.id"
                @menu="openMenu($event, element)"
                @save="onSave(element, $event)"
                @cancel-edit="editingId = null"
              />
            </template>
          </draggable>

          <div v-if="filter === 'all' && completedTodos.length" class="divider" />

          <div v-if="showCompletedHeader" class="section-label done">
            已完成 · {{ completedTodos.length }}
          </div>
          <draggable
            v-if="filter !== 'active'"
            :model-value="completedTodos"
            item-key="id"
            handle=".drag-handle"
            :animation="180"
            ghost-class="drag-ghost"
            @update:model-value="onCompletedReorder"
          >
            <template #item="{ element }">
              <TodoItem
                :todo="element"
                :editing="editingId === element.id"
                @check="toggleTodo(element)"
                @edit="editingId = element.id"
                @menu="openMenu($event, element)"
                @save="onSave(element, $event)"
                @cancel-edit="editingId = null"
              />
            </template>
          </draggable>
        </template>
      </template>
    </div>

    <TodoFilterBar :filter="filter" @change="setFilter" />
    <TodoImportDialog v-model="importOpen" @import="onImport" />
    <TodoContextMenu
      :visible="menu.visible"
      :x="menu.x"
      :y="menu.y"
      :todo="menu.todo"
      @toggle="onMenuToggle"
      @edit="onMenuEdit"
      @top="onMenuTop"
      @remove="onMenuRemove"
      @restore="onMenuRestore"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import draggable from 'vuedraggable'
import { ElMessage } from 'element-plus'
import TodoContextMenu from './TodoContextMenu.vue'
import TodoFilterBar from './TodoFilterBar.vue'
import TodoImportDialog from './TodoImportDialog.vue'
import TodoItem from './TodoItem.vue'
import { useTodos } from '../composables/useTodos'
import type { Todo } from '../types'

const {
  counts,
  filter,
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
} = useTodos()

const adding = ref(false)
const draft = ref('')
const addInputRef = ref<HTMLInputElement | null>(null)
const importOpen = ref(false)
const editingId = ref<number | null>(null)
const menu = reactive({
  visible: false,
  x: 0,
  y: 0,
  todo: null as Todo | null,
})

const isEmpty = computed(() => {
  if (filter.value === 'deleted') return deletedTodos.value.length === 0
  if (filter.value === 'completed') return completedTodos.value.length === 0
  if (filter.value === 'active') return activeTodos.value.length === 0
  return activeTodos.value.length === 0 && completedTodos.value.length === 0
})

const showActiveHeader = computed(
  () => filter.value === 'all' && (activeTodos.value.length > 0 || completedTodos.value.length > 0),
)
const showCompletedHeader = computed(
  () => filter.value === 'all' && completedTodos.value.length > 0,
)

const emptyText = computed(() => {
  if (filter.value === 'deleted') return '回收站是空的'
  if (filter.value === 'completed') return '还没有已完成的事情'
  return '还没有需要做的事情'
})

async function startAdd() {
  if (filter.value === 'deleted' || filter.value === 'completed') {
    await setFilter('all')
  }
  adding.value = true
  draft.value = ''
  await nextTick()
  addInputRef.value?.focus()
}

function cancelAdd() {
  adding.value = false
  draft.value = ''
}

async function submitAdd() {
  const text = draft.value.trim()
  adding.value = false
  draft.value = ''
  if (text) await addTodo(text)
}

function openMenu(event: MouseEvent, todo: Todo) {
  event.stopPropagation()
  menu.visible = true
  menu.todo = todo
  menu.x = Math.min(event.clientX, window.innerWidth - 190)
  menu.y = Math.min(event.clientY, window.innerHeight - 180)
}

function closeMenu() {
  menu.visible = false
  menu.todo = null
}

function onMenuToggle() {
  if (menu.todo) void toggleTodo(menu.todo)
  closeMenu()
}

function onMenuEdit() {
  if (menu.todo) editingId.value = menu.todo.id
  closeMenu()
}

function onMenuTop() {
  if (menu.todo) void moveToTop(menu.todo)
  closeMenu()
}

function onMenuRemove() {
  if (menu.todo) void confirmDelete(menu.todo)
  closeMenu()
}

function onMenuRestore() {
  if (menu.todo) void restoreTodo(menu.todo)
  closeMenu()
}

function onSave(todo: Todo, content: string) {
  editingId.value = null
  void editTodo(todo, content)
}

function onActiveReorder(list: Todo[]) {
  void persistGroupOrder(list, completedTodos.value)
}

function onCompletedReorder(list: Todo[]) {
  void persistGroupOrder(activeTodos.value, list)
}

async function onImport(text: string) {
  try {
    const count = await importText(text)
    importOpen.value = false
    ElMessage.success(`已导入 ${count} 条`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导入失败')
  }
}

function onDocClick() {
  if (menu.visible) closeMenu()
}

onMounted(() => {
  void load()
  document.addEventListener('click', onDocClick)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
})
</script>

<style scoped lang="less">
.todo-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f8f8f8;
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 28px 28px 12px;
  flex-shrink: 0;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-row h1 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
}

.badge {
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.import-btn {
  height: 32px;
  padding: 0 10px;
  color: var(--color-text-secondary);
  font-size: 13px;
  border-radius: var(--radius-md);

  &:hover {
    background: rgba(0, 0, 0, 0.04);
    color: var(--color-text);
  }
}

.add-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 20px;
  line-height: 1;
  transition: background 160ms ease;

  &:hover {
    background: var(--accent-hover);
  }
}

.body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px 18px 24px;
}

.section-label {
  margin: 8px 8px 6px;
  font-size: 12px;
  color: var(--color-text-secondary);

  &.done {
    margin-top: 18px;
  }
}

.divider {
  height: 1px;
  margin: 18px 8px 4px;
  background: var(--color-border);
}

.composer {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  padding: 4px 6px 4px 10px;
}

.check-placeholder {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1.5px dashed var(--color-check);
}

.composer input {
  flex: 1;
  border: 0;
  outline: none;
  font-size: 12px;
  background: transparent;
}

.empty {
  padding: 80px 20px 0;
  text-align: center;
  color: var(--color-text-tertiary);
}

.empty-circle {
  display: inline-block;
  width: 22px;
  height: 22px;
  border: 1.5px solid var(--color-check);
  border-radius: 50%;
}

.empty p {
  margin: 16px 0 12px;
  font-size: 14px;
}

.empty button {
  color: var(--accent);
  font-size: 13px;
}

.drag-ghost {
  opacity: 0.55;
  background: rgba(0, 0, 0, 0.03);
  border-radius: var(--radius-md);
}
</style>
