<template>
  <el-dialog
    :model-value="modelValue"
    class="wb-dialog settings-dialog"
    width="840px"
    align-center
    append-to-body
    destroy-on-close
    @close="close"
  >
    <template #header>
      <div class="dialog-head">
        <div class="title">设置</div>
        <div class="sub">外观颜色与笔记管理</div>
      </div>
    </template>

    <div class="settings-layout">
      <nav class="nav">
        <button
          v-for="item in tabs"
          :key="item.id"
          class="nav-item"
          type="button"
          :class="{ active: tab === item.id }"
          @click="tab = item.id"
        >
          {{ item.label }}
        </button>
      </nav>

      <div class="pane">
        <section v-if="tab === 'appearance'" class="section">
          <div class="section-title">外观颜色</div>
          <p class="section-desc">用于按钮、选中态和高亮强调色，立即生效。</p>
          <AccentPicker />
        </section>

        <section v-else class="section notes-section">
          <div class="notes-head">
            <div>
              <div class="section-title">笔记管理</div>
              <p class="section-desc">
                拖拽可调整顺序，会同步到首页切换笔记列表；停用的笔记不会出现在切换列表中。
              </p>
            </div>
            <button class="btn primary" type="button" @click="onCreate">新增笔记</button>
          </div>

          <div class="table">
            <div class="table-head">
              <span class="col handle" />
              <span class="col name">名称</span>
              <span class="col status">状态</span>
              <span class="col time">更新时间</span>
              <span class="col actions">操作</span>
            </div>
            <div v-if="notes.length === 0" class="empty">还没有笔记</div>
            <draggable
              v-else
              :model-value="notes"
              item-key="id"
              handle=".drag-handle"
              :animation="180"
              :force-fallback="true"
              :fallback-on-body="true"
              ghost-class="settings-note-ghost"
              @update:model-value="onReorder"
            >
              <template #item="{ element: note }">
                <div class="row">
                  <span class="col handle">
                    <span class="drag-handle" title="拖拽排序">
                      <i /><i /><i /><i /><i /><i />
                    </span>
                  </span>
                  <span class="col name">
                    <span class="note-title">{{ note.title }}</span>
                    <span v-if="note.id === currentId" class="current">当前</span>
                  </span>
                  <span class="col status">
                    <span class="badge" :class="{ off: note.disabled }">
                      {{ note.disabled ? '已停用' : '使用中' }}
                    </span>
                  </span>
                  <span class="col time">{{ formatTime(note.updatedAt) }}</span>
                  <span class="col actions">
                    <button type="button" @click="onRename(note)">编辑</button>
                    <button type="button" :disabled="disableLast(note)" @click="onToggle(note)">
                      {{ note.disabled ? '启用' : '停用' }}
                    </button>
                    <button
                      class="danger"
                      type="button"
                      :disabled="disableLast(note)"
                      @click="onDelete(note)"
                    >
                      删除
                    </button>
                  </span>
                </div>
              </template>
            </draggable>
          </div>
        </section>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElDialog, ElMessage, ElMessageBox } from 'element-plus'
import draggable from 'vuedraggable'
import AccentPicker from './AccentPicker.vue'
import { useNote } from '../composables/useNote'
import type { NoteMeta } from '../types'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
}>()

const tabs = [
  { id: 'appearance' as const, label: '外观颜色' },
  { id: 'notes' as const, label: '笔记管理' },
]

const tab = ref<(typeof tabs)[number]['id']>('appearance')
const {
  notes,
  currentId,
  enabledCount,
  refreshList,
  addNote,
  renameNote,
  setNoteDisabled,
  removeNote,
  reorderNotes,
} = useNote()

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    tab.value = 'appearance'
    void refreshList().catch(() => {
      ElMessage.error('无法加载笔记列表')
    })
  },
)

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
    hour12: false,
  })
}

function disableLast(note: NoteMeta) {
  return !note.disabled && enabledCount.value <= 1
}

async function onReorder(next: NoteMeta[]) {
  try {
    await reorderNotes(next.map((item) => item.id))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '排序失败')
  }
}

async function promptTitle(title: string, value: string) {
  try {
    const { value: next } = await ElMessageBox.prompt('请输入笔记名称', title, {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputValue: value,
      inputPlaceholder: '例如：工作笔记',
      customClass: 'wb-message-box',
      inputValidator: (raw) => {
        if (!raw || !raw.trim()) return '名称不能为空'
        if (raw.trim().length > 40) return '名称最多 40 个字'
        return true
      },
    })
    return String(next).trim()
  } catch {
    return null
  }
}

async function onCreate() {
  const title = await promptTitle('新增笔记', '')
  if (!title) return
  try {
    await addNote(title)
    ElMessage.success('已新增笔记')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '新增失败')
  }
}

async function onRename(note: NoteMeta) {
  const title = await promptTitle('编辑笔记', note.title)
  if (!title) return
  try {
    await renameNote(note.id, title)
    ElMessage.success('已更新名称')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '编辑失败')
  }
}

async function onToggle(note: NoteMeta) {
  try {
    await setNoteDisabled(note.id, !note.disabled)
    ElMessage.success(note.disabled ? '已启用' : '已停用')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '操作失败')
  }
}

async function onDelete(note: NoteMeta) {
  try {
    await ElMessageBox.confirm(`确定删除「${note.title}」？删除后不可恢复。`, '删除笔记', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
      customClass: 'wb-message-box',
    })
  } catch {
    return
  }

  try {
    await removeNote(note.id)
    ElMessage.success('已删除')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除失败')
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

.settings-layout {
  display: flex;
  min-height: min(64vh, 560px);
  max-height: min(72vh, 640px);
  margin: 0 -8px;
}

.nav {
  width: 180px;
  flex-shrink: 0;
  padding: 4px 12px 8px 0;
  border-right: 1px solid var(--color-border);
}

.nav-item {
  display: block;
  width: 100%;
  height: 38px;
  padding: 0 12px;
  border-radius: 10px;
  text-align: left;
  font-size: 13px;
  color: var(--color-text-secondary);

  &:hover {
    background: rgba(0, 0, 0, 0.04);
    color: var(--color-text);
  }

  &.active {
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 600;
  }
}

.pane {
  flex: 1;
  min-width: 0;
  padding: 4px 8px 8px 24px;
  overflow: auto;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.section-desc {
  margin: 8px 0 18px;
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.notes-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 8px;
}

.btn {
  height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 13px;

  &.primary {
    background: var(--accent);
    color: #fff;

    &:hover {
      filter: brightness(0.96);
    }
  }
}

.table {
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
}

.table-head,
.row {
  display: grid;
  grid-template-columns: 20px minmax(0, 1.4fr) 60px 90px 140px;
  gap: 12px;
  align-items: center;
  padding: 0 16px;
  min-height: 44px;
}

.table-head {
  background: #fafaf8;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.row {
  background: #fff;
  border-top: 1px solid var(--color-border-light);
  font-size: 13px;
}

.col.handle {
  display: flex;
  justify-content: center;
}

.drag-handle {
  width: 12px;
  height: 14px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px;
  cursor: grab;
  flex-shrink: 0;
  place-content: center;

  i {
    width: 2px;
    height: 2px;
    border-radius: 50%;
    background: #c8c8c4;
  }

  &:active {
    cursor: grabbing;
  }
}

.row:hover .drag-handle i {
  background: #9a9a96;
}

.empty {
  padding: 36px 0;
  text-align: center;
  color: var(--color-text-tertiary);
  font-size: 13px;
}

.col.name {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.note-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text);
}

.current {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11px;
}

.badge {
  font-size: 12px;
  color: #22c55e;

  &.off {
    color: var(--color-text-tertiary);
  }
}

.col.time {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.col.actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;

  button {
    height: 28px;
    padding: 0 8px;
    border-radius: 6px;
    font-size: 12px;
    color: var(--color-text-secondary);

    &:hover:not(:disabled) {
      background: rgba(0, 0, 0, 0.04);
      color: var(--color-text);
    }

    &.danger:hover:not(:disabled) {
      color: var(--color-danger);
      background: rgba(209, 67, 67, 0.06);
    }

    &:disabled {
      opacity: 0.35;
    }
  }
}
</style>

<style lang="less">
.settings-note-ghost {
  opacity: 0.55;
  background: rgba(0, 0, 0, 0.03);
}
</style>
