<template>
  <div class="note-switcher" ref="rootRef">
    <button
      class="trigger"
      type="button"
      :class="{ open }"
      :title="currentTitle"
      aria-label="切换笔记"
      @click="open = !open"
    >
      <span class="label">{{ currentTitle }}</span>
      <el-icon :size="12"><ArrowDown /></el-icon>
    </button>
    <div v-if="open" class="panel">
      <div class="panel-title">切换笔记</div>
      <button
        v-for="note in activeNotes"
        :key="note.id"
        class="item"
        type="button"
        :class="{ active: note.id === currentId }"
        @click="choose(note.id)"
      >
        {{ note.title }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'
import { ElIcon, ElMessage } from 'element-plus'
import { useNote } from '../composables/useNote'

const { currentId, currentNote, activeNotes, switchNote } = useNote()
const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const currentTitle = computed(() => currentNote.value?.title || '默认笔记')

async function choose(id: number) {
  open.value = false
  if (id === currentId.value) return
  try {
    await switchNote(id)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '切换失败')
  }
}

function onDocClick(event: MouseEvent) {
  if (!open.value) return
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onDocClick))
onUnmounted(() => document.removeEventListener('mousedown', onDocClick))
</script>

<style scoped lang="less">
.note-switcher {
  position: relative;
}

.trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100px;
  height: 28px;
  padding: 0 4px 0 8px;
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  transition:
    background 160ms ease,
    color 160ms ease;

  &:hover,
  &.open {
    background: rgba(0, 0, 0, 0.04);
    color: var(--color-text);
  }
}

.label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
}

.panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 30;
  min-width: 180px;
  max-width: 260px;
  padding: 8px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow: var(--shadow-float);
  backdrop-filter: blur(20px);
}

.panel-title {
  padding: 4px 8px 8px;
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.item {
  display: block;
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border-radius: 8px;
  line-height: 34px;
  font-size: 13px;
  color: var(--color-text);
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  &.active {
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 600;
  }
}
</style>
