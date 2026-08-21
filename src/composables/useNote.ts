import { onUnmounted, ref } from 'vue'
import { fetchNote, saveNote as apiSaveNote } from '../api/note'
import type { SaveState } from '../types'

const DEBOUNCE_MS = 500

function isEmptyHtml(html: string): boolean {
  const text = html
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .trim()
  return text.length === 0
}

export function useNote() {
  const content = ref('')
  const saveState = ref<SaveState>('saved')
  const lastSavedAt = ref<string | null>(null)
  const loaded = ref(false)

  let timer: ReturnType<typeof setTimeout> | null = null
  let requestId = 0

  function markEditing() {
    if (saveState.value !== 'saving') saveState.value = 'editing'
  }

  async function flush(next = content.value): Promise<boolean> {
    if (!loaded.value) return false
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    const current = ++requestId
    saveState.value = 'saving'
    try {
      const saved = await apiSaveNote(next)
      if (current !== requestId) return false
      content.value = next
      lastSavedAt.value = saved.updatedAt
      saveState.value = 'saved'
      return true
    } catch {
      if (current !== requestId) return false
      saveState.value = 'error'
      return false
    }
  }

  async function saveNow(next = content.value): Promise<boolean> {
    return flush(next)
  }

  function queueSave(next: string) {
    content.value = next
    if (!loaded.value) return
    markEditing()
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void flush(next)
    }, DEBOUNCE_MS)
  }

  async function load() {
    const note = await fetchNote()
    content.value = note.content || ''
    lastSavedAt.value = note.updatedAt
    saveState.value = 'saved'
    loaded.value = true
    return content.value
  }

  onUnmounted(() => {
    if (timer) clearTimeout(timer)
  })

  return {
    content,
    saveState,
    lastSavedAt,
    loaded,
    isEmptyHtml,
    queueSave,
    load,
    flush,
    saveNow,
  }
}
