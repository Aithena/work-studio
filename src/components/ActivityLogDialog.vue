<template>
  <el-dialog
    :model-value="modelValue"
    class="wb-dialog activity-dialog"
    width="1040px"
    align-center
    append-to-body
    destroy-on-close
    @close="close"
  >
    <template #header>
      <div class="dialog-head">
        <div class="title">操作日志</div>
        <div class="sub">热力概览与近期操作明细</div>
      </div>
    </template>

    <div class="dialog-body">
      <div class="heatmap-block">
        <ActivityHeatmap embedded />
      </div>

      <div class="logs-head">
        <span>明细</span>
        <span class="count">{{ logs.length }} 条</span>
      </div>

      <div class="logs-scroll">
        <div v-if="logs.length === 0" class="logs-empty">还没有操作记录</div>
        <div v-else class="logs">
          <div v-for="item in logs" :key="item.id" class="log-row">
            <div class="log-main">
              <span class="source" :class="sourceClass(item)">{{ sourceLabel(item) }}</span>
              <span class="action" :class="actionClass(item.action)">{{ actionLabel(item.action) }}</span>
              <span class="summary">{{ item.summary || '—' }}</span>
            </div>
            <div class="log-meta">{{ formatTime(item.createdAt) }}</div>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElDialog } from 'element-plus'
import ActivityHeatmap from './ActivityHeatmap.vue'
import { fetchActivityLogs, type OperationLogItem } from '../api/activity'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
}>()

const logs = ref<OperationLogItem[]>([])

const ACTION_LABELS: Record<string, string> = {
  'todo.create': '新增',
  'todo.import': '导入',
  'todo.update': '编辑',
  'todo.complete': '完成',
  'todo.uncomplete': '恢复未完成',
  'todo.delete': '删除',
  'todo.restore': '恢复',
  'todo.purge': '清除',
  'todo.priority': '优先级',
  'note.save': '保存',
  'ai.chat': 'AI 对话',
}

function sourceLabel(item: OperationLogItem) {
  if (item.targetType === 'todo' || item.action.startsWith('todo.')) return '任务'
  return '笔记'
}

function sourceClass(item: OperationLogItem) {
  return sourceLabel(item) === '任务' ? 'is-task' : 'is-note'
}

function actionLabel(action: string) {
  return ACTION_LABELS[action] || action
}

function actionClass(action: string) {
  if (action === 'ai.chat') return 'is-ai'
  if (action === 'todo.complete') return 'is-complete'
  return ''
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function close() {
  emit('update:modelValue', false)
}

async function loadLogs() {
  try {
    const data = await fetchActivityLogs(120)
    logs.value = data.items
  } catch {
    logs.value = []
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      void loadLogs()
      window.dispatchEvent(new Event('workbench:activity'))
    }
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

.heatmap-block {
  flex-shrink: 0;
}

.logs-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 18px 4px 10px;
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

.logs-empty {
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
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 36px;
  padding: 8px 10px;
  border-radius: 8px;

  &:hover {
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

.source {
  flex-shrink: 0;
  width: 2em;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-tertiary);

  &.is-task {
    color: #64748b;
  }

  &.is-note {
    color: #64748b;
  }
}

.action {
  flex-shrink: 0;
  width: 5em;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);

  &.is-ai {
    background: linear-gradient(90deg, #6c42f9, #fc5292, #fb2c2e, #6c42f9);
    background-size: 200% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    animation: ai-gradient 2.4s linear infinite;
  }

  &.is-complete {
    color: #22c55e;
  }
}

@keyframes ai-gradient {
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 200% 50%;
  }
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
  font-size: 12px;
  color: var(--color-text-tertiary);
}
</style>
