<template>
  <el-dialog
    :model-value="modelValue"
    class="wb-dialog import-dialog"
    width="800px"
    align-center
    :show-close="true"
    @close="close"
  >
    <template #header>
      <div class="dialog-head">
        <div class="title">导入任务</div>
        <div class="sub">每行一条任务，粘贴后自动拆分</div>
      </div>
    </template>
    <textarea
      v-model="text"
      class="import-area"
      rows="8"
      placeholder="修改首页 UI&#10;检查 API&#10;提交 GitHub"
      @keydown.ctrl.enter="submit"
    />
    <template #footer>
      <div class="footer">
        <button class="btn ghost" type="button" @click="close">取消</button>
        <button class="btn primary" type="button" :disabled="!canSubmit" @click="submit">
          导入
        </button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElDialog, ElMessage } from 'element-plus'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  import: [text: string]
}>()

const text = ref('')
const canSubmit = computed(() => text.value.split(/\r?\n/).some((line) => line.trim()))

watch(
  () => props.modelValue,
  (open) => {
    if (open) text.value = ''
  },
)

function close() {
  emit('update:modelValue', false)
}

function submit() {
  if (!canSubmit.value) {
    ElMessage.warning('没有可导入的内容')
    return
  }
  emit('import', text.value)
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
  margin-top: 8px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.import-area {
  width: 100%;
  min-height: 180px;
  padding: 14px 16px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  resize: vertical;
  outline: none;
  font-size: 14px;
  line-height: 1.7;
  color: var(--color-text);
  background: #fafaf8;

  &:focus {
    border-color: var(--accent);
  }
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  min-width: 72px;
  height: 36px;
  padding: 0 16px;
  border-radius: var(--radius-md);
  font-size: 14px;
  transition: background 160ms ease;

  &.ghost {
    color: var(--color-text-secondary);

    &:hover {
      background: #f5f5f3;
    }
  }

  &.primary {
    background: var(--color-text);
    color: #fff;

    &:disabled {
      opacity: 0.35;
    }
  }
}
</style>
