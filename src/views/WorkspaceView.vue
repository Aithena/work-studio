<template>
  <div class="workspace">
    <AppHeader :save-state="saveState" :saved-at="lastSavedAt" />
    <div class="workspace-body">
      <SplitPane>
        <template #left>
          <TodoPanel />
        </template>
        <template #right>
          <div class="right-pane">
            <NoteEditor
              ref="editorRef"
              class="editor"
              :model-value="content"
              :loaded="loaded"
              @change="onNoteChange"
            />
          </div>
        </template>
      </SplitPane>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ElNotification } from 'element-plus'
import AppHeader from '../components/AppHeader.vue'
import NoteEditor from '../components/NoteEditor.vue'
import SplitPane from '../components/SplitPane.vue'
import TodoPanel from '../components/TodoPanel.vue'
import { useNote } from '../composables/useNote'

const { content, saveState, lastSavedAt, loaded, queueSave, load, saveNow } = useNote()
const editorRef = ref<{ getHtml: () => string } | null>(null)
let savingManual = false

function onNoteChange(value: string) {
  queueSave(value)
  window.setTimeout(() => {
    window.dispatchEvent(new Event('workbench:activity'))
  }, 700)
}

async function handleManualSave() {
  if (!loaded.value || savingManual) return
  savingManual = true
  try {
    const html = editorRef.value?.getHtml() ?? content.value
    content.value = html
    const ok = await saveNow(html)
    if (ok) {
      ElNotification({
        title: '笔记已保存',
        message: '手动保存成功',
        type: 'success',
        duration: 2200,
      })
      window.dispatchEvent(new Event('workbench:activity'))
    } else {
      ElNotification({
        title: '保存失败',
        message: '请稍后重试，编辑内容仍保留在本地',
        type: 'error',
        duration: 3200,
      })
    }
  } finally {
    savingManual = false
  }
}

function onKeydown(event: KeyboardEvent) {
  const key = event.key.toLowerCase()
  if (!(event.ctrlKey || event.metaKey) || key !== 's') return
  event.preventDefault()
  void handleManualSave()
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  try {
    await load()
  } catch (error) {
    ElNotification.error({
      title: '无法加载笔记',
      message: error instanceof Error ? error.message : '请确认本地服务已启动',
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped lang="less">
.workspace {
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--color-page);
  overflow: hidden;
}

.workspace-body {
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
}

.right-pane {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--color-surface);
}

.editor {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
