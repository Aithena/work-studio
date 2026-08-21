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
        <div class="sub">导出为 zip（含任务、笔记与图片）；导入将覆盖现有数据</div>
      </div>
    </template>

    <div v-if="mode === 'choose'" class="choices">
      <button class="choice" type="button" :disabled="busy" @click="doExport">
        <span class="choice-title">导出数据</span>
        <span class="choice-desc">下载 zip 压缩包（data.json + uploads）</span>
      </button>
      <button class="choice" type="button" :disabled="busy" @click="mode = 'import'">
        <span class="choice-title">导入数据</span>
        <span class="choice-desc">从 zip 备份恢复，将覆盖现有数据</span>
      </button>
    </div>

    <div v-else class="import-pane">
      <p class="warn">导入会覆盖当前全部任务、笔记与本地图片，建议先导出一份备份。</p>
      <input
        ref="fileRef"
        class="file-input"
        type="file"
        accept=".zip,application/zip"
        @change="onFileChange"
      />
      <div v-if="fileName" class="file-name">已选择：{{ fileName }}</div>
    </div>

    <template #footer>
      <div class="footer">
        <button
          v-if="mode === 'import'"
          class="btn ghost"
          type="button"
          :disabled="busy"
          @click="mode = 'choose'"
        >
          返回
        </button>
        <button class="btn ghost" type="button" :disabled="busy" @click="close">取消</button>
        <button
          v-if="mode === 'import'"
          class="btn primary"
          type="button"
          :disabled="busy || !pendingFile"
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
import { downloadExportZip, importBackupFile } from '../api/backup'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
}>()

const mode = ref<'choose' | 'import'>('choose')
const busy = ref(false)
const fileName = ref('')
const pendingFile = ref<File | null>(null)
const fileRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    mode.value = 'choose'
    busy.value = false
    fileName.value = ''
    pendingFile.value = null
  },
)

function close() {
  emit('update:modelValue', false)
}

async function doExport() {
  busy.value = true
  try {
    const { blob, filename } = await downloadExportZip()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('已导出 zip 备份')
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
  pendingFile.value = null
  fileName.value = ''
  if (!file) return
  pendingFile.value = file
  fileName.value = file.name
}

async function doImport() {
  if (!pendingFile.value) return
  try {
    await ElMessageBox.confirm(
      '导入将覆盖当前任务、笔记与本地图片，此操作不可撤销。',
      '确认导入？',
      {
        confirmButtonText: '覆盖导入',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'wb-message-box',
      },
    )
  } catch {
    return
  }

  busy.value = true
  try {
    const result = await importBackupFile(pendingFile.value)
    const imgTip = result.imageCount > 0 ? `，${result.imageCount} 张图片` : ''
    ElMessage.success(`已导入 ${result.todoCount} 条任务${imgTip}`)
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
