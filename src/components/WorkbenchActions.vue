<template>
  <div class="workbench-actions">
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
    <button
      class="icon-btn"
      type="button"
      title="导入 / 导出"
      aria-label="导入 / 导出"
      @click="transferOpen = true"
    >
      <el-icon :size="16"><FolderOpened /></el-icon>
    </button>
    <button
      class="icon-btn"
      type="button"
      title="搜索任务 (Ctrl+K)"
      aria-label="搜索"
      @click="openSearch"
    >
      <el-icon :size="16"><Search /></el-icon>
    </button>
    <button
      class="icon-btn"
      type="button"
      title="设置"
      aria-label="设置"
      @click="settingsOpen = true"
    >
      <el-icon :size="16"><Setting /></el-icon>
    </button>
    <QuickLinksMenu />
    <ActivityLogDialog v-model="logOpen" />
    <DataTransferDialog v-model="transferOpen" />
    <SettingsDialog v-model="settingsOpen" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { FolderOpened, Notebook, Search, Setting } from '@element-plus/icons-vue'
import { ElIcon } from 'element-plus'
import ActivityLogDialog from './ActivityLogDialog.vue'
import DataTransferDialog from './DataTransferDialog.vue'
import QuickLinksMenu from './QuickLinksMenu.vue'
import SaveStatus from './SaveStatus.vue'
import SettingsDialog from './SettingsDialog.vue'
import type { SaveState } from '../types'

defineProps<{
  saveState: SaveState
  savedAt: string | null
}>()

const logOpen = ref(false)
const transferOpen = ref(false)
const settingsOpen = ref(false)

function openSearch() {
  window.dispatchEvent(new Event('workbench:search'))
}

function onKeydown(event: KeyboardEvent) {
  const key = event.key.toLowerCase()
  if (!(event.ctrlKey || event.metaKey) || key !== 'k') return
  event.preventDefault()
  openSearch()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped lang="less">
.workbench-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;

  :deep(.icon-btn) {
    width: 28px;
    height: 28px;
  }
}

.icon-btn {
  width: 28px;
  height: 28px;
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
