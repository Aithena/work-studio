<template>
  <header class="app-header">
    <div class="brand">我的工作台</div>
    <div class="actions">
      <SaveStatus :state="saveState" :saved-at="savedAt" />
      <button
        class="icon-btn"
        type="button"
        title="操作日志"
        aria-label="操作日志"
        @click="logOpen = true"
      >
        <el-icon :size="16"><Notebook /></el-icon>
      </button>
      <button class="icon-btn" type="button" title="搜索即将推出" aria-label="搜索">
        <el-icon :size="16"><Search /></el-icon>
      </button>
      <AccentPicker />
      <QuickLinksMenu />
    </div>
    <ActivityLogDialog v-model="logOpen" />
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Notebook, Search } from '@element-plus/icons-vue'
import { ElIcon } from 'element-plus'
import AccentPicker from './AccentPicker.vue'
import ActivityLogDialog from './ActivityLogDialog.vue'
import QuickLinksMenu from './QuickLinksMenu.vue'
import SaveStatus from './SaveStatus.vue'
import type { SaveState } from '../types'

defineProps<{
  saveState: SaveState
  savedAt: string | null
}>()

const logOpen = ref(false)
</script>

<style scoped lang="less">
.app-header {
  height: 56px;
  padding: 0 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-page);
}

.brand {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.icon-btn {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  border-radius: var(--radius-md);
  transition:
    background 160ms ease,
    color 160ms ease;

  &:hover {
    background: rgba(0, 0, 0, 0.04);
    color: var(--color-text);
  }
}
</style>
