<template>
  <section class="note-editor">
    <div ref="elRef" class="editor-host" @dblclick="onEditorDblClick" />
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

    <Teleport to="body">
      <div
        v-if="previewSrc"
        class="img-lightbox"
        role="dialog"
        aria-label="图片预览"
        @click="closePreview"
      >
        <button class="lightbox-close" type="button" aria-label="关闭" @click="closePreview">
          ×
        </button>
        <img class="lightbox-img" :src="previewSrc" alt="预览" @click.stop />
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { AiEditor } from 'aieditor'
import type { BubbleMenuItem } from 'aieditor'
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
const previewSrc = ref<string | null>(null)
let editor: AiEditor | null = null
let syncing = false

const PREVIEW_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M16 3H22V9H20V5H16V3ZM2 3H8V5H4V9H2V3ZM20 19V15H22V21H16V19H20ZM4 19H8V21H2V15H4V19ZM12 8C14.7614 8 17 10.2386 17 13C17 15.7614 14.7614 18 12 18C9.23858 18 7 15.7614 7 13C7 10.2386 9.23858 8 12 8ZM12 10C10.3431 10 9 11.3431 9 13C9 14.6569 10.3431 16 12 16C13.6569 16 15 14.6569 15 13C15 11.3431 13.6569 10 12 10Z"/></svg>'

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

function openPreview(src: string) {
  if (!src) return
  previewSrc.value = src
}

function closePreview() {
  previewSrc.value = null
}

function previewFromEditor(instance: AiEditor) {
  const attrs = instance.getAttributes('image')
  const src = String(attrs.src || attrs['data-src'] || '')
  openPreview(src)
}

function onEditorDblClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (!target) return
  const img = target.closest('img') as HTMLImageElement | null
  if (!img || !elRef.value?.contains(img)) return
  event.preventDefault()
  openPreview(img.currentSrc || img.src)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && previewSrc.value) {
    event.preventDefault()
    closePreview()
  }
}

const previewMenuItem: BubbleMenuItem = {
  id: 'image-preview',
  title: '预览',
  icon: PREVIEW_ICON,
  onClick: (instance) => previewFromEditor(instance),
}

onMounted(() => {
  if (!elRef.value) return
  window.addEventListener('keydown', onKeydown)

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
    image: {
      allowBase64: false,
      uploadUrl: '/api/image/upload',
      uploadFormName: 'image',
      defaultSize: 480,
      bubbleMenuItems: [
        previewMenuItem,
        'AlignLeft',
        'AlignCenter',
        'AlignRight',
        'imageLink',
        'imageProperty',
        'delete',
      ],
      uploaderEvent: {
        onFailed: (_file, response) => {
          const message =
            response && typeof response === 'object' && 'errorMessage' in response
              ? String((response as { errorMessage?: string }).errorMessage || '图片上传失败')
              : '图片上传失败'
          console.warn('[note-editor] image upload failed', message)
        },
        onError: (_file, error) => {
          console.warn('[note-editor] image upload error', error)
        },
      },
    },
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
  window.removeEventListener('keydown', onKeydown)
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

<style lang="less">
.img-lightbox {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background: rgba(10, 10, 10, 0.78);
  backdrop-filter: blur(8px);
  cursor: zoom-out;
}

.lightbox-img {
  max-width: min(96vw, 1400px);
  max-height: 92vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
  cursor: default;
  background: #111;
}

.lightbox-close {
  position: absolute;
  top: 18px;
  right: 22px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 24px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 160ms ease;

  &:hover {
    background: rgba(255, 255, 255, 0.22);
  }
}
</style>
