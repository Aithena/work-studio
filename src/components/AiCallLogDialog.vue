<template>
  <el-dialog
    :model-value="modelValue"
    class="wb-dialog ai-call-dialog"
    width="840px"
    align-center
    append-to-body
    destroy-on-close
    @close="close"
  >
    <template #header>
      <div class="dialog-head">
        <div class="title">AI 调用记录</div>
        <div class="sub">时间、模型、Token 与每次调用的原始请求 / 响应</div>
      </div>
    </template>

    <div class="dialog-body">
      <div class="logs-head">
        <span>明细</span>
        <span class="count">{{ items.length }} 条</span>
      </div>

      <div class="logs-scroll">
        <div v-if="items.length === 0" class="logs-empty">还没有 AI 调用记录</div>
        <div v-else class="logs">
          <div
            v-for="item in items"
            :key="item.id"
            class="log-row"
            :class="{ open: expandedId === item.id }"
            @click="toggle(item)"
          >
            <div class="log-main">
              <span class="status" :class="item.status === 'success' ? 'ok' : 'bad'">
                {{ item.status === 'success' ? '成功' : '失败' }}
              </span>
              <span class="model">{{ item.model || '未知模型' }}</span>
              <span class="tokens">{{ tokenText(item) }}</span>
              <span class="summary">{{ item.errorMessage || item.preview || '—' }}</span>
            </div>
            <div class="log-meta">
              <span>{{ durationText(item.durationMs) }}</span>
              <span>{{ formatTime(item.createdAt) }}</span>
            </div>
            <div v-if="expandedId === item.id" class="detail" @click.stop>
              <div v-if="detailLoading && !detail" class="detail-loading">正在加载原始数据…</div>
              <template v-else-if="detail">
                <div class="detail-grid">
                  <div>HTTP {{ detail.httpStatus ?? '—' }}</div>
                  <div>结束原因 {{ detail.finishReason || '—' }}</div>
                  <div>输入 {{ detail.promptTokens ?? '—' }}</div>
                  <div>输出 {{ detail.completionTokens ?? '—' }}</div>
                  <div>合计 {{ detail.totalTokens ?? '—' }}</div>
                  <div>{{ durationText(detail.durationMs) }}</div>
                </div>
                <div v-if="detail.errorMessage" class="error">{{ detail.errorMessage }}</div>
                <div class="block">
                  <div class="block-title">请求原文 request_json</div>
                  <pre>{{ pretty(detail.requestJson) }}</pre>
                </div>
                <div class="block">
                  <div class="block-title">解析结果 response_json</div>
                  <pre>{{ pretty(detail.responseJson) }}</pre>
                </div>
                <div class="block">
                  <div class="block-title">原始 SSE / 响应 raw_sse</div>
                  <pre>{{ detail.rawSse || '—' }}</pre>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElDialog } from 'element-plus'
import { fetchAiCall, fetchAiCalls, type AiCallItem } from '../api/ai'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
}>()

const items = ref<AiCallItem[]>([])
const expandedId = ref<number | null>(null)
const detail = ref<AiCallItem | null>(null)
const detailLoading = ref(false)

function close() {
  emit('update:modelValue', false)
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function durationText(ms: number | null) {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

function tokenText(item: AiCallItem) {
  if (item.totalTokens == null && item.promptTokens == null && item.completionTokens == null) {
    return 'Token —'
  }
  const prompt = item.promptTokens ?? '—'
  const completion = item.completionTokens ?? '—'
  const total = item.totalTokens ?? '—'
  return `${prompt} → ${completion} / ${total}`
}

function pretty(value: string | null) {
  if (!value) return '—'
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

async function toggle(item: AiCallItem) {
  if (expandedId.value === item.id) {
    expandedId.value = null
    detail.value = null
    return
  }
  expandedId.value = item.id
  detail.value = null
  detailLoading.value = true
  try {
    detail.value = await fetchAiCall(item.id)
  } catch {
    detail.value = item
  } finally {
    detailLoading.value = false
  }
}

async function load() {
  try {
    const data = await fetchAiCalls(120)
    items.value = data.items
  } catch {
    items.value = []
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) {
      expandedId.value = null
      detail.value = null
      return
    }
    void load()
  },
)
</script>

<style scoped lang="less">
.dialog-head {
  text-align: left;
}

.title {
  font-size: 18px;
  font-weight: 600;
}

.sub {
  margin-top: 6px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.dialog-body {
  display: flex;
  flex-direction: column;
  height: min(72vh, 640px);
  max-height: min(72vh, 640px);
  overflow: hidden;
  padding-bottom: 4px;
}

.logs-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 4px 10px;
  font-size: 13px;
  color: var(--color-text);
  font-weight: 600;
  flex-shrink: 0;
}

.count {
  font-weight: 400;
  color: var(--color-text-tertiary);
}

.logs-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
}

.logs-empty,
.detail-loading {
  padding: 28px 0;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-tertiary);
}

.logs {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.log-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  min-height: 36px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;

  &:hover,
  &.open {
    background: rgba(0, 0, 0, 0.03);
  }
}

.log-main {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.status {
  flex-shrink: 0;
  width: 2em;
  font-size: 12px;
  font-weight: 600;

  &.ok {
    color: #22c55e;
  }

  &.bad {
    color: var(--color-danger, #ef4444);
  }
}

.model {
  flex-shrink: 0;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
}

.tokens {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.summary {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--color-text);
  text-align: left;
}

.log-meta {
  flex-shrink: 0;
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.detail {
  width: 100%;
  padding: 4px 2px 8px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px 12px;
  margin-bottom: 10px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.error {
  margin-bottom: 10px;
  font-size: 12px;
  color: var(--color-danger, #ef4444);
}

.block {
  margin-top: 10px;
}

.block-title {
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

pre {
  max-height: 220px;
  margin: 0;
  padding: 10px 12px;
  overflow: auto;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.04);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  text-align: left;
  color: var(--color-text);
}
</style>
