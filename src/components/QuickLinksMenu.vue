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
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { Connection } from '@element-plus/icons-vue'
import { ElIcon } from 'element-plus'

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const links = [
  { label: '图片工具箱', url: 'https://aithena.github.io/img-tools/#/ico' },
  { label: '文本工具箱', url: 'https://aithena.github.io/str-tools/' },
  { label: '订单LBS', url: 'https://aithena.github.io/kys-order-lbs/' },
  { label: '接口文档', url: 'http://127.0.0.1:18902/' },
]

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
  min-width: 168px;
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
  height: 34px;
  padding: 0 10px;
  border-radius: 8px;
  line-height: 34px;
  font-size: 13px;
  color: var(--color-text);
  text-decoration: none;
  transition: background 160ms ease;

  &:hover {
    background: rgba(0, 0, 0, 0.05);
    color: var(--accent);
  }
}
</style>
