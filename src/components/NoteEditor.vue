<template>
  <section class="note-editor">
    <div ref="elRef" class="editor-host" />
    <div v-if="showEmpty" class="empty" @click="focusEditor">
      <div class="empty-title">开始记录…</div>
      <div class="empty-sub">在这里随手记录你的想法、AI 对话、代码片段、链接、灵感…</div>
      <div class="tips">
        <div class="tips-title">快捷操作</div>
        <div class="tip"><span>/</span>输入 / 唤起命令</div>
        <div class="tip"><span>⌘</span>Ctrl + / 快速打开命令面板</div>
        <div class="tip"><span>↥</span>拖拽文件到这里粘贴或上传</div>
        <div class="tip"><span>●</span>内容会自动保存，无需手动操作</div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { AiEditor } from 'aieditor'
import 'aieditor/dist/style.css'
import '../styles/editor.less'

const props = defineProps<{
  modelValue: string
  loaded: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
}>()

const elRef = ref<HTMLElement | null>(null)
let editor: AiEditor | null = null
let syncing = false

const html = computed(() => props.modelValue || '')
const showEmpty = computed(() => {
  const value = html.value
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .trim()
  return props.loaded && value.length === 0
})

function focusEditor() {
  const root = elRef.value?.querySelector('.aie-content') as HTMLElement | null
  root?.focus()
}

onMounted(() => {
  if (!elRef.value) return
  editor = new AiEditor({
    element: elRef.value,
    placeholder: '',
    content: props.modelValue || '',
    contentRetention: false,
    lang: 'zh',
    draggable: false,
    toolbarKeys: [
      'undo',
      'redo',
      '|',
      'bold',
      'italic',
      'strike',
      '|',
      'heading',
      '|',
      'bullet-list',
      'todo',
      'hr',
      'quote',
      'code-block',
      'link',
      'image',
      '|',
      'ai',
      'fullscreen',
    ],
    ai: {
      models: {
        openai: {
          customUrl: () => '/api/ai/v1/chat/completions',
          apiKey: 'local',
          model: 'deepseek-v4-flash',
        },
      },
    },
    onChange: (instance) => {
      if (syncing) return
      const next = instance.getHtml()
      emit('update:modelValue', next)
      emit('change', next)
    },
  })
})

watch(
  () => props.modelValue,
  (value) => {
    if (!editor) return
    const next = value || ''
    if (next === editor.getHtml()) return
    syncing = true
    editor.setContent(next)
    syncing = false
  },
)

onUnmounted(() => {
  editor?.destroy()
  editor = null
})

defineExpose({
  getHtml: () => editor?.getHtml() ?? '',
})
</script>

<style scoped lang="less">
.note-editor {
  position: relative;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--color-surface);
}

.editor-host {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.empty {
  position: absolute;
  inset: 72px 0 0;
  padding: 8px 56px 48px;
  pointer-events: none;
}

.empty-title {
  font-size: 30px;
  font-weight: 400;
  color: var(--color-text-tertiary);
  line-height: 1.3;
}

.empty-sub {
  margin-top: 12px;
  max-width: 520px;
  font-size: 14px;
  line-height: 1.7;
  color: #b0b0b0;
}

.tips {
  margin-top: 64px;
  pointer-events: none;
}

.tips-title {
  margin-bottom: 14px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.tip {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  font-size: 13px;
  color: var(--color-text-tertiary);

  span {
    width: 22px;
    color: var(--color-text-secondary);
    text-align: center;
  }
}
</style>
