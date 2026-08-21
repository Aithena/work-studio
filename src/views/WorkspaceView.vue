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
import { onMounted } from 'vue'
import { ElNotification } from 'element-plus'
import AppHeader from '../components/AppHeader.vue'
import NoteEditor from '../components/NoteEditor.vue'
import SplitPane from '../components/SplitPane.vue'
import TodoPanel from '../components/TodoPanel.vue'
import { useNote } from '../composables/useNote'

const { content, saveState, lastSavedAt, loaded, queueSave, load } = useNote()

function onNoteChange(value: string) {
  queueSave(value)
  window.setTimeout(() => {
    window.dispatchEvent(new Event('workbench:activity'))
  }, 700)
}

onMounted(async () => {
  try {
    await load()
  } catch (error) {
    ElNotification.error({
      title: '无法加载笔记',
      message: error instanceof Error ? error.message : '请确认本地服务已启动',
    })
  }
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
