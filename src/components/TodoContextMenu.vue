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
      <div v-if="todo && !todo.deleted" class="sep" />
      <button v-if="todo && !todo.deleted" class="danger" type="button" @click="emit('remove')">
        删除
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { Todo } from '../types'

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
  restore: []
}>()
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
</style>
