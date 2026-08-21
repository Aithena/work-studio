<template>
  <div class="accent-picker" ref="rootRef">
    <button
      class="icon-btn"
      type="button"
      title="外观"
      aria-label="外观"
      @click="open = !open"
    >
      <el-icon :size="16"><Sunny /></el-icon>
    </button>
    <div v-if="open" class="panel">
      <div class="panel-title">外观颜色</div>
      <div class="swatches">
        <button
          v-for="color in ACCENT_PRESETS"
          :key="color"
          class="swatch"
          type="button"
          :class="{ active: color === current }"
          :style="{ background: color }"
          :aria-label="color"
          @click="choose(color)"
        />
        <label class="swatch custom" title="自定义颜色">
          <input type="color" :value="current" @input="onCustom" />
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { Sunny } from '@element-plus/icons-vue'
import { ElIcon } from 'element-plus'
import { ACCENT_PRESETS, applyAccent, readAccent } from '../composables/useAccent'

const open = ref(false)
const current = ref(readAccent())
const rootRef = ref<HTMLElement | null>(null)

function choose(color: string) {
  current.value = color
  applyAccent(color)
}

function onCustom(event: Event) {
  const value = (event.target as HTMLInputElement).value
  choose(value)
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
.accent-picker {
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
  transition:
    background 160ms ease,
    color 160ms ease;

  &:hover {
    background: rgba(0, 0, 0, 0.04);
    color: var(--color-text);
  }
}

.panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 20;
  width: 220px;
  padding: 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow: var(--shadow-float);
  backdrop-filter: blur(20px);
}

.panel-title {
  margin-bottom: 10px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.swatches {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}

.swatch {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);

  &.active {
    border-color: var(--color-text);
  }

  &.custom {
    background: conic-gradient(from 90deg, #ff6b6b, #f7d046, #4cd964, #5ac8fa, #007aff, #ff6b6b);
    overflow: hidden;
  }

  input {
    opacity: 0;
    width: 22px;
    height: 22px;
    cursor: pointer;
  }
}
</style>
