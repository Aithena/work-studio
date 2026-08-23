import { computed, ref } from 'vue'
import {
  createNote as apiCreateNote,
  deleteNote as apiDeleteNote,
  fetchNote,
  fetchNotes,
  saveNote as apiSaveNote,
  updateNote as apiUpdateNote,
} from '../api/note'
import type { NoteMeta, SaveState } from '../types'

const DEBOUNCE_MS = 500
const NOTE_ID_KEY = 'workbench.current-note-id'

const notes = ref<NoteMeta[]>([])
const currentId = ref(1)
const content = ref('')
const saveState = ref<SaveState>('saved')
const lastSavedAt = ref<string | null>(null)
const loaded = ref(false)

let timer: ReturnType<typeof setTimeout> | null = null
let requestId = 0

function isEmptyHtml(html: string): boolean {
  const text = html
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .trim()
  return text.length === 0
}

function readStoredId(): number | null {
  try {
    const raw = localStorage.getItem(NOTE_ID_KEY)
    if (raw == null) return null
    const id = Number(raw)
    return Number.isInteger(id) && id > 0 ? id : null
  } catch {
    return null
  }
}

function persistId(id: number) {
  try {
    localStorage.setItem(NOTE_ID_KEY, String(id))
  } catch {
    // ignore
  }
}

function pickCurrentId(list: NoteMeta[]): number {
  const enabled = list.filter((item) => !item.disabled)
  const stored = readStoredId()
  if (stored && enabled.some((item) => item.id === stored)) return stored
  if (enabled.some((item) => item.id === 1)) return 1
  if (enabled[0]) return enabled[0].id
  return list[0]?.id ?? 1
}

function markEditing() {
  if (saveState.value !== 'saving') saveState.value = 'editing'
}

function toMeta(item: NoteMeta): NoteMeta {
  return {
    id: item.id,
    title: item.title,
    disabled: item.disabled,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

async function refreshList() {
  const data = await fetchNotes()
  notes.value = data.items
}

async function flush(next = content.value): Promise<boolean> {
  if (!loaded.value) return false
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  const current = ++requestId
  const noteId = currentId.value
  saveState.value = 'saving'
  try {
    const saved = await apiSaveNote(next, noteId)
    if (current !== requestId) return false
    content.value = next
    lastSavedAt.value = saved.updatedAt
    saveState.value = 'saved'
    const index = notes.value.findIndex((item) => item.id === saved.id)
    if (index !== -1) notes.value[index] = toMeta(saved)
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

async function openNote(id: number, skipFlush = false) {
  if (!skipFlush && loaded.value && id !== currentId.value) {
    await flush()
  }
  const note = await fetchNote(id)
  currentId.value = note.id
  persistId(note.id)
  content.value = note.content || ''
  lastSavedAt.value = note.updatedAt
  saveState.value = 'saved'
  loaded.value = true
  const index = notes.value.findIndex((item) => item.id === note.id)
  if (index === -1) notes.value.push(toMeta(note))
  else notes.value[index] = toMeta(note)
}

async function load() {
  await refreshList()
  const id = pickCurrentId(notes.value)
  await openNote(id, true)
  return content.value
}

async function switchNote(id: number) {
  if (id === currentId.value) return
  await openNote(id)
}

async function addNote(title: string) {
  const note = await apiCreateNote(title)
  await refreshList()
  await openNote(note.id)
  return note
}

async function renameNote(id: number, title: string) {
  const note = await apiUpdateNote(id, { title })
  await refreshList()
  return note
}

async function setNoteDisabled(id: number, disabled: boolean) {
  await apiUpdateNote(id, { disabled })
  await refreshList()
  if (disabled && id === currentId.value) {
    const next = pickCurrentId(notes.value)
    if (next !== id) await openNote(next, true)
  }
}

async function removeNote(id: number) {
  await apiDeleteNote(id)
  const wasCurrent = id === currentId.value
  await refreshList()
  if (wasCurrent) {
    const next = pickCurrentId(notes.value)
    await openNote(next, true)
  }
}

export function useNote() {
  const currentNote = computed(() => notes.value.find((item) => item.id === currentId.value) ?? null)
  const activeNotes = computed(() => notes.value.filter((item) => !item.disabled))
  const enabledCount = computed(() => activeNotes.value.length)

  return {
    notes,
    currentId,
    currentNote,
    activeNotes,
    enabledCount,
    content,
    saveState,
    lastSavedAt,
    loaded,
    isEmptyHtml,
    queueSave,
    load,
    refreshList,
    flush,
    saveNow,
    switchNote,
    addNote,
    renameNote,
    setNoteDisabled,
    removeNote,
  }
}
