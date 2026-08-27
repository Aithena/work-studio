<template>
  <div class="workspace">
    <div class="workspace-body">
      <SplitPane>
        <template #left>
          <TodoPanel />
        </template>
        <template #right>
          <div class="right-pane">
            <div class="right-pane-header">
              <NoteSwitcher class="pane-switcher" />
              <WorkbenchActions
                class="pane-actions"
                :save-state="saveState"
                :saved-at="lastSavedAt"
              />
            </div>
            <NoteEditor
              ref="editorRef"
              class="editor"
              :model-value="content"
              :loaded="loaded"
              :note-id="currentId"
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
import NoteEditor from '../components/NoteEditor.vue'
import NoteSwitcher from '../components/NoteSwitcher.vue'
import SplitPane from '../components/SplitPane.vue'
import TodoPanel from '../components/TodoPanel.vue'
import WorkbenchActions from '../components/WorkbenchActions.vue'
import { useNote } from '../composables/useNote'

const { content, currentId, saveState, lastSavedAt, loaded, queueSave, load, saveNow } = useNote()
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
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--color-surface);
}

.right-pane-header {
  height: 40px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f8f8f8;
  border-left: 1px solid #fff;
}

.pane-switcher {
  // position: absolute;
  // top: 10px;
  // left: 12px;
  z-index: 8;
}

.pane-actions {
  // position: absolute;
  // top: 10px;
  // right: 16px;
  z-index: 8;
}

.editor {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
