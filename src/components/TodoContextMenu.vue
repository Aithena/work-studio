<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="ctx-menu"
      :style="{ left: `${x}px`, top: `${y}px` }"
      @mousedown.stop
    >
      <button v-if="todo && todo.deleted" type="button" @click="emit('restore')">恢复</button>
      <button v-else-if="todo && todo.completed" type="button" @click="emit('toggle')">
        恢复未完成
      </button>
      <button v-else type="button" @click="emit('toggle')">标记完成</button>
      <button v-if="todo && !todo.deleted" type="button" @click="emit('edit')">编辑</button>
      <button
        v-if="todo && !todo.deleted && !todo.completed"
        type="button"
        @click="emit('top')"
      >
        移到顶部
      </button>

      <template v-if="todo && !todo.deleted && !todo.completed">
        <div class="sep" />
        <div class="priority-row">
          <button
            v-for="p in priorities"
            :key="p"
            type="button"
            class="p-btn"
            :class="{ active: todo.priority === p }"
            :data-p="p"
            @click="emit('priority', p)"
          >
            {{ p }}
          </button>
          <button
            type="button"
            class="p-btn clear"
            :class="{ active: !todo.priority }"
            @click="emit('priority', null)"
          >
            无
          </button>
        </div>
      </template>

      <div v-if="todo" class="sep" />
      <button v-if="todo && todo.deleted" class="danger" type="button" @click="emit('purge')">
        清除
      </button>
      <button v-else-if="todo" class="danger" type="button" @click="emit('remove')">删除</button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { Todo, TodoPriority } from '../types'
import { TODO_PRIORITIES } from '../utils/todoPriority'

defineProps<{
  visible: boolean
  x: number
  y: number
  todo: Todo | null
}>()

const emit = defineEmits<{
  toggle: []
  edit: []
  top: []
  remove: []
  purge: []
  restore: []
  priority: [value: TodoPriority | null]
}>()

const priorities = TODO_PRIORITIES
</script>

<style scoped lang="less">
.ctx-menu {
  position: fixed;
  z-index: 40;
  min-width: 168px;
  padding: 6px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow: var(--shadow-float);
  backdrop-filter: blur(20px);
}

button {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border-radius: 8px;
  text-align: left;
  font-size: 13px;
  color: var(--color-text);

  &:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  &.danger {
    color: var(--color-danger);
  }
}

.sep {
  height: 1px;
  margin: 4px 6px;
  background: var(--color-border);
}

.priority-row {
  display: flex;
  gap: 4px;
  padding: 2px 2px 4px;
}

.p-btn {
  width: auto;
  flex: 1;
  height: 28px;
  padding: 0;
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--color-text-secondary);

  &.active {
    color: var(--color-text);
    background: rgba(0, 0, 0, 0.06);
  }

  &[data-p='P0'].active {
    color: #c62828;
    background: rgba(198, 40, 40, 0.12);
  }

  &[data-p='P1'].active {
    color: #f57c00;
    background: rgba(245, 124, 0, 0.14);
  }

  &[data-p='P2'].active {
    color: #1565c0;
    background: rgba(21, 101, 192, 0.12);
  }

  &[data-p='P3'].active {
    color: #6b6b66;
    background: rgba(0, 0, 0, 0.06);
  }

  &.clear {
    flex: 0.85;
    font-weight: 500;
  }
}
</style>
