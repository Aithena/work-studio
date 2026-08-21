<template>
  <div
    class="todo-item"
    :class="{ done: todo.completed, deleted: todo.deleted, editing }"
    @contextmenu.prevent="$emit('menu', $event)"
  >
    <button class="check" type="button" :aria-label="checkLabel" @click="$emit('check')" />
    <input
      v-if="editing"
      ref="inputRef"
      v-model="draft"
      class="edit-input"
      @keydown.enter.prevent="commit"
      @keydown.esc.prevent="$emit('cancel-edit')"
      @blur="commit"
    />
    <div v-else class="main">
      <span class="text" @dblclick="$emit('edit')">{{ todo.content }}</span>
      <span
        v-if="todo.priority && !todo.completed"
        class="priority"
        :data-p="todo.priority"
        :title="`优先级 ${todo.priority}`"
      >
        {{ todo.priority }}
      </span>
    </div>
    <span class="drag-handle" title="拖拽排序">
      <i /><i /><i /><i /><i /><i />
    </span>
    <button class="more" type="button" aria-label="更多操作" @click.stop="$emit('menu', $event)">
      ⋮
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { Todo } from '../types'

const props = defineProps<{
  todo: Todo
  editing: boolean
}>()

const emit = defineEmits<{
  check: []
  edit: []
  menu: [event: MouseEvent]
  save: [content: string]
  'cancel-edit': []
}>()

const draft = ref(props.todo.content)
const inputRef = ref<HTMLInputElement | null>(null)

const checkLabel = computed(() => {
  if (props.todo.deleted) return '恢复'
  return props.todo.completed ? '标记为未完成' : '标记为完成'
})

watch(
  () => props.editing,
  async (editing) => {
    if (!editing) return
    draft.value = props.todo.content
    await nextTick()
    inputRef.value?.focus()
    inputRef.value?.select()
  },
)

function commit() {
  emit('save', draft.value)
}
</script>

<style scoped lang="less">
.todo-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  padding: 4px 6px 4px 10px;
  border-radius: var(--radius-md);
  transition: background 160ms ease;

  &:hover {
    background: rgba(0, 0, 0, 0.025);

    .drag-handle,
    .more {
      opacity: 1;
    }
  }
}

.drag-handle {
  width: 12px;
  height: 14px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 2px;
  opacity: 0;
  cursor: grab;
  flex-shrink: 0;
  place-content: center;

  i {
    width: 2px;
    height: 2px;
    border-radius: 50%;
    background: #c8c8c4;
  }
}

.check {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1.5px solid var(--color-check);
  background: transparent;
  flex-shrink: 0;
  transition:
    border-color 160ms ease,
    background 160ms ease;

  &:hover {
    border-color: var(--accent);
  }
}

.main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.text {
  min-width: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.priority {
  flex-shrink: 0;
  height: 16px;
  padding: 0 4px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 16px;
  font-variant-numeric: tabular-nums;

  &[data-p='P0'] {
    color: #c62828;
    background: rgba(198, 40, 40, 0.1);
  }

  &[data-p='P1'] {
    color: #f57c00;
    background: rgba(245, 124, 0, 0.12);
  }

  &[data-p='P2'] {
    color: #1565c0;
    background: rgba(21, 101, 192, 0.1);
  }

  &[data-p='P3'] {
    color: #6b6b66;
    background: rgba(0, 0, 0, 0.05);
  }
}

.more {
  width: 20px;
  height: 20px;
  opacity: 0;
  color: var(--color-text-tertiary);
  font-size: 14px;
  letter-spacing: 1px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.edit-input {
  flex: 1;
  height: 22px;
  border: 0;
  outline: none;
  background: transparent;
  font-size: 12px;
  color: var(--color-text);
}

.todo-item.done {
  .check {
    border-color: transparent;
    background: var(--color-done-bg);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='%23C8C8C5' stroke-width='1.8' d='M4 8.2l2.4 2.3L12 5.4'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: center;
    background-size: 10px;
  }

  .text {
    color: var(--color-text-tertiary);
    text-decoration: line-through;
    text-decoration-thickness: 1px;
  }
}

.todo-item.deleted .text {
  color: var(--color-text-tertiary);
}
</style>
