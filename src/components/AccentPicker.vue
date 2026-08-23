<template>
  <div class="accent-picker">
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
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ACCENT_PRESETS, applyAccent, readAccent } from '../composables/useAccent'

const current = ref(readAccent())

function choose(color: string) {
  current.value = color
  applyAccent(color)
}

function onCustom(event: Event) {
  choose((event.target as HTMLInputElement).value)
}
</script>

<style scoped lang="less">
.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.swatch {
  width: 28px;
  height: 28px;
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
    width: 28px;
    height: 28px;
    cursor: pointer;
  }
}
</style>
