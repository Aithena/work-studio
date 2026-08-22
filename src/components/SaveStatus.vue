<template>
  <div class="save-status" :data-state="state" :title="hint">
    <span class="dot" />
    <span class="label">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SaveState } from '../types'

const props = defineProps<{
  state: SaveState
  savedAt: string | null
}>()

function formatTime(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const label = computed(() => {
  if (props.state === 'editing') return '编辑中'
  if (props.state === 'saving') return '保存中'
  if (props.state === 'error') return '保存失败'
  const time = formatTime(props.savedAt)
  return time ? `已保存 · ${time}` : '已保存'
})

const hint = computed(() => {
  if (props.state === 'error') return '保存失败，内容仍保留在编辑器中'
  if (props.savedAt) return `最后保存 ${new Date(props.savedAt).toLocaleString('zh-CN')}`
  return '内容会自动保存'
})
</script>

<style scoped lang="less">
.save-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: 4px;
  color: var(--color-text-secondary);
  font-size: 12px;
  white-space: nowrap;
  user-select: none;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-saved);
}

.save-status[data-state='editing'] .dot,
.save-status[data-state='saving'] .dot {
  background: var(--color-text-tertiary);
  animation: pulse 1.2s ease-in-out infinite;
}

.save-status[data-state='error'] {
  color: var(--color-danger);

  .dot {
    background: var(--color-danger);
    animation: none;
  }
}

@keyframes pulse {
  50% {
    opacity: 0.35;
  }
}
</style>
