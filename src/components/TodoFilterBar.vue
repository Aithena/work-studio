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
    icon: '<svg viewBox="0 0 1027 1024" width="11" height="11"><path d="M38.771627 310.656a36.608 36.608 0 1 1 0-73.130667h220.117333a255.957333 255.957333 0 0 1 510.634667 0h220.074666a36.608 36.608 0 1 1 0 73.130667h-76.288L850.37696 919.296c-6.272 59.605333-53.205333 104.661333-109.056 104.661333H287.006293c-55.850667 0-102.784-45.098667-108.928-104.661333L114.931627 310.656H38.771627z m212.053333 599.978667a37.546667 37.546667 0 0 0 36.224 34.901333h454.229333a37.546667 37.546667 0 0 0 36.352-34.901333l62.122667-599.936H188.531627l62.293333 599.936zM696.13696 237.482667a182.826667 182.826667 0 0 0-363.904 0h363.904z m-64.938667 566.997333l-43.904-73.130667h53.504l-63.36-109.781333 41.472-74.581333 116.992 202.624a36.608 36.608 0 0 1-31.744 54.869333h-72.96z m-73.088 0H324.126293a36.48 36.48 0 0 1-31.658666-54.869333l36.48-63.189334 85.290666-1.450666-26.752 46.378666h126.72l43.904 73.130667z m24.277334-320.810667l-41.472 74.624L514.163627 511.914667l-63.36 109.696-85.248 1.493333 116.906666-202.666667a36.522667 36.522667 0 0 1 63.317334 0l36.608 63.232z" p-id="4069" fill="#707070"></path></svg>',
  },
]
</script>

<style scoped lang="less">
.filter-bar {
  display: flex;
  align-items: center;
  gap: 0px;
  height: 40px;
  padding: 0 10px;
  border-top: 0;
  background: #efefef;
  flex-shrink: 0;
}

.filter-btn {
  flex: 1;
  height: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--color-text-secondary);
  font-size: 10px;
  border-radius: 2px;
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
