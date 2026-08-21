<template>
  <nav class="filter-bar">
    <button
      v-for="item in items"
      :key="item.value"
      class="filter-btn"
      type="button"
      :class="{ active: item.value === filter }"
      @click="$emit('change', item.value)"
    >
      <span class="icon" v-html="item.icon" />
      <span>{{ item.label }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import type { TodoFilter } from '../types'

defineProps<{
  filter: TodoFilter
}>()

defineEmits<{
  change: [value: TodoFilter]
}>()

const items: { value: TodoFilter; label: string; icon: string }[] = [
  {
    value: 'all',
    label: '全部',
    icon: '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="currentColor" d="M2 3h12v1.5H2V3zm0 4.25h12V9H2V7.25zM2 11.5h12V13H2v-1.5z"/></svg>',
  },
  {
    value: 'active',
    label: '未完成',
    icon: '<svg viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="8" r="5.2" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  },
  {
    value: 'completed',
    label: '已完成',
    icon: '<svg viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="8" r="5.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path fill="none" stroke="currentColor" stroke-width="1.4" d="M5.4 8.1l1.8 1.8 3.5-3.6"/></svg>',
  },
  {
    value: 'deleted',
    label: '回收站',
    icon: '<svg viewBox="0 0 16 16" width="14" height="14"><path fill="none" stroke="currentColor" stroke-width="1.4" d="M3.5 5h9M6 5V3.8A.8.8 0 0 1 6.8 3h2.4a.8.8 0 0 1 .8.8V5m-.8 0v7.2a.8.8 0 0 1-.8.8H7.6a.8.8 0 0 1-.8-.8V5"/></svg>',
  },
]
</script>

<style scoped lang="less">
.filter-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 52px;
  padding: 0 16px;
  border-top: 0;
  background: #efefef;
  flex-shrink: 0;
}

.filter-btn {
  flex: 1;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--color-text-secondary);
  font-size: 12px;
  border-radius: 8px;
  transition:
    color 160ms ease,
    background 160ms ease;

  &:hover {
    background: rgba(0, 0, 0, 0.03);
    color: var(--color-text);
  }

  &.active {
    color: var(--accent);
    background: var(--accent-soft);
  }
}

.icon {
  display: inline-flex;
}
</style>
