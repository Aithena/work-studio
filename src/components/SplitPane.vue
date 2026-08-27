<template>
  <div ref="rootRef" class="split-pane">
    <div class="pane pane-left" :style="{ width: `${leftPercent}%` }">
      <slot name="left" />
    </div>
    <div
      class="gutter"
      role="separator"
      aria-orientation="vertical"
      :aria-valuenow="Math.round(leftPercent)"
      @mousedown.prevent="onStart"
    >
      <span class="handle" />
    </div>
    <div class="pane pane-right">
      <slot name="right" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { clampSplit, persistSplit, readSplit } from '../composables/useSplitRatio'

const rootRef = ref<HTMLElement | null>(null)
const ratio = ref(readSplit())
const dragging = ref(false)

const leftPercent = computed(() => ratio.value * 100)

function currentWidth() {
  return rootRef.value?.getBoundingClientRect().width || window.innerWidth
}

function apply(next: number) {
  ratio.value = clampSplit(next, currentWidth())
}

function onStart(event: MouseEvent) {
  dragging.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  move(event)
}

function move(event: MouseEvent) {
  if (!dragging.value || !rootRef.value) return
  const rect = rootRef.value.getBoundingClientRect()
  apply((event.clientX - rect.left) / rect.width)
}

function stop() {
  if (!dragging.value) return
  dragging.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  persistSplit(ratio.value)
}

function onResize() {
  apply(ratio.value)
}

onMounted(() => {
  apply(ratio.value)
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', stop)
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', move)
  window.removeEventListener('mouseup', stop)
  window.removeEventListener('resize', onResize)
})
</script>

<style scoped lang="less">
.split-pane {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.pane {
  min-width: 260px;
  min-height: 0;
  height: 100%;
}

.pane-left {
  max-width: 260px;
}

.pane-right {
  flex: 1;
  min-width: 500px;
}

.gutter {
  width: 0;
  position: relative;
  z-index: 2;
  cursor: col-resize;
  flex-shrink: 0;
  background: transparent;
}

.gutter::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -6px;
  width: 12px;
}

.handle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 10px;
  height: 28px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: #ecece8;
  box-shadow: inset 0 0 0 1px #e2e2de;
}

.handle::before {
  content: '';
  position: absolute;
  inset: 8px 3px;
  background:
    radial-gradient(circle, #bdbdb8 1.1px, transparent 1.2px) 0 0 / 4px 6px;
}
</style>
