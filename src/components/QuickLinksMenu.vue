<template>
  <div class="quick-links" ref="rootRef">
    <button
      class="icon-btn"
      type="button"
      title="快捷链接"
      aria-label="快捷链接"
      :class="{ open }"
      @click="open = !open"
    >
      <el-icon size="16"><Connection /></el-icon>
    </button>
    <div v-if="open" class="panel">
      <div class="panel-title">快捷链接</div>
      <a
        v-for="item in links"
        :key="item.url"
        class="link-item"
        :href="item.url"
        target="_blank"
        rel="noopener noreferrer"
        @click="open = false"
      >
        {{ item.label }}
      </a>
      <button class="link-item" type="button" @click="openGallery">素材集图库</button>
      <a
        class="link-item"
        href="https://aithena.github.io/kys-order-lbs/"
        target="_blank"
        rel="noopener noreferrer"
        @click="open = false"
      >
        康医手订单（LBS）
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { Connection } from '@element-plus/icons-vue'
import { ElIcon, ElMessage } from 'element-plus'

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const links = [
  { label: '图片工具箱', url: 'https://aithena.github.io/img-tools/#/ico' },
  { label: '文本工具箱', url: 'https://aithena.github.io/str-tools/' },
]

async function openGallery() {
  open.value = false
  const tab = window.open('about:blank', '_blank')
  if (tab) tab.opener = null
  try {
    const res = await fetch('/api/gallery-handoff')
    const body = (await res.json()) as { url?: string; message?: string }
    if (!res.ok || typeof body.url !== 'string' || !body.url) {
      throw new Error(body.message || '无法打开素材集图库')
    }
    if (tab) tab.location.replace(body.url)
    else window.open(body.url, '_blank', 'noopener')
  } catch (error) {
    tab?.close()
    ElMessage.error(error instanceof Error ? error.message : '无法打开素材集图库')
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
.quick-links {
  position: relative;
}

.icon-btn {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  transition:
    background 160ms ease,
    color 160ms ease,
    border-color 160ms ease;

  &:hover,
  &.open {
    background: rgba(0, 0, 0, 0.04);
    color: var(--color-text);
    border-color: var(--color-border);
  }
}

.panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 30;
  min-width: 188px;
  padding: 8px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow: var(--shadow-float);
  backdrop-filter: blur(20px);
}

.panel-title {
  padding: 4px 8px 8px;
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.link-item {
  display: block;
  height: 28px;
  padding: 0 10px;
  border-radius: 8px;
  box-sizing: border-box;
  width: 100%;
  border: 0;
  background: transparent;
  text-align: left;
  font-family: inherit;
  font-size: 12px;
  font-weight: 400;
  line-height: 28px;
  white-space: nowrap;
  color: var(--color-text);
  cursor: pointer;
  text-decoration: none;
  transition: background 160ms ease;

  &:hover {
    background: rgba(0, 0, 0, 0.05);
    color: var(--accent);
  }
}
</style>
