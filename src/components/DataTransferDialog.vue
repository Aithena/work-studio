<template>
  <el-dialog
    :model-value="modelValue"
    class="wb-dialog transfer-dialog"
    width="480px"
    align-center
    :show-close="true"
    @close="close"
  >
    <template #header>
      <div class="dialog-head">
        <div class="title">导入 / 导出</div>
        <div class="sub">导出可下载 JSON；导入将覆盖当前任务与笔记</div>
      </div>
    </template>

    <div v-if="mode === 'choose'" class="choices">
      <button class="choice" type="button" :disabled="busy" @click="doExport">
        <span class="choice-title">导出数据</span>
        <span class="choice-desc">下载当前任务与笔记备份文件</span>
      </button>
      <button class="choice" type="button" :disabled="busy" @click="mode = 'import'">
        <span class="choice-title">导入数据</span>
        <span class="choice-desc">从备份 JSON 恢复，将覆盖现有数据</span>
      </button>
    </div>

    <div v-else class="import-pane">
      <p class="warn">导入会覆盖当前全部任务与笔记，建议先导出一份备份。</p>
      <input
        ref="fileRef"
        class="file-input"
        type="file"
        accept="application/json,.json"
        @change="onFileChange"
      />
      <div v-if="fileName" class="file-name">已选择：{{ fileName }}</div>
    </div>

    <template #footer>
      <div class="footer">
        <button v-if="mode === 'import'" class="btn ghost" type="button" :disabled="busy" @click="mode = 'choose'">
          返回
        </button>
        <button class="btn ghost" type="button" :disabled="busy" @click="close">取消</button>
        <button
          v-if="mode === 'import'"
          class="btn primary"
          type="button"
          :disabled="busy || !pendingPayload"
          @click="doImport"
        >
          {{ busy ? '导入中…' : '确认导入' }}
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElDialog, ElMessage, ElMessageBox } from 'element-plus'
import { fetchExportBackup, importBackup, type BackupPayload } from '../api/backup'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
}>()

const mode = ref<'choose' | 'import'>('choose')
const busy = ref(false)
const fileName = ref('')
const pendingPayload = ref<BackupPayload | null>(null)
const fileRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    mode.value = 'choose'
    busy.value = false
    fileName.value = ''
    pendingPayload.value = null
  },
)

function close() {
  emit('update:modelValue', false)
}

async function doExport() {
  busy.value = true
  try {
    const { filename, payload } = await fetchExportBackup()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('已导出备份文件')
    close()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导出失败')
  } finally {
    busy.value = false
  }
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  pendingPayload.value = null
  fileName.value = ''
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result)) as BackupPayload
      if (parsed?.version !== 1 || !parsed.note || !Array.isArray(parsed.todos)) {
        throw new Error('不是有效的工作台备份文件')
      }
      pendingPayload.value = parsed
      fileName.value = file.name
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '无法读取备份文件')
      input.value = ''
    }
  }
  reader.readAsText(file, 'utf-8')
}

async function doImport() {
  if (!pendingPayload.value) return
  try {
    await ElMessageBox.confirm('导入将覆盖当前任务与笔记，此操作不可撤销。', '确认导入？', {
      confirmButtonText: '覆盖导入',
      cancelButtonText: '取消',
      type: 'warning',
      customClass: 'wb-message-box',
    })
  } catch {
    return
  }

  busy.value = true
  try {
    const result = await importBackup(pendingPayload.value)
    ElMessage.success(`已导入 ${result.todoCount} 条任务`)
    close()
    window.location.reload()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导入失败')
  } finally {
    busy.value = false
  }
}
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

.choices {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.choice {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background: #fff;
  text-align: left;
  transition:
    border-color 160ms ease,
    background 160ms ease;

  &:hover:not(:disabled) {
    border-color: var(--accent);
    background: var(--accent-soft);
  }

  &:disabled {
    opacity: 0.6;
  }
}

.choice-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.choice-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.import-pane {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.warn {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.file-input {
  font-size: 13px;
}

.file-name {
  font-size: 12px;
  color: var(--color-text);
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 13px;

  &.ghost {
    color: var(--color-text-secondary);

    &:hover:not(:disabled) {
      background: rgba(0, 0, 0, 0.04);
      color: var(--color-text);
    }
  }

  &.primary {
    background: var(--accent);
    color: #fff;

    &:hover:not(:disabled) {
      filter: brightness(0.96);
    }

    &:disabled {
      opacity: 0.45;
    }
  }
}
</style>
