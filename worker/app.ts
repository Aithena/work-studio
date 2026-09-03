import { Hono, type Context } from 'hono'
import { getAiCall, listAiCalls } from './ai-logs'
import { proxyChatCompletions } from './ai'
import { listActivity, getMonthOverview, listOperationLogs } from './activity'
import { buildExportZip, importBackupZip } from './backup'
import {
  createNote,
  deleteNote,
  ensureDefaultNote,
  getNote,
  listNotes,
  reorderNotes,
  saveNote,
  updateNote,
} from './notes'
import {
  createTodo,
  createTodos,
  getTodo,
  listTodos,
  purgeTodo,
  reorderTodos,
  softDeleteTodo,
  updateTodo,
  getCounts,
  type TodoFilter,
} from './todos'
import { contentTypeFor, getUploadedObject, saveUploadedImage } from './uploads'
import type { NoteRow, TodoRow, WorkerEnv } from './env'

const api = new Hono<{ Bindings: WorkerEnv }>()

function ok(data: unknown) {
  return { success: true as const, data }
}

function fail(message: string) {
  return { success: false as const, message }
}

function mapTodo(row: TodoRow) {
  return {
    id: row.id,
    content: row.content,
    completed: row.completed === 1,
    deleted: row.deleted === 1,
    priority: row.priority ?? null,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  }
}

const PRIORITIES = new Set(['P0', 'P1', 'P2', 'P3'])

function parseId(raw: string): number | null {
  const id = Number(raw)
  if (!Number.isInteger(id) || id <= 0) return null
  return id
}

function parseIdList(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null
  const ids = raw.map((value) => (typeof value === 'number' ? value : Number(value)))
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) return null
  return ids
}

async function handleNoteReorder(c: Context<{ Bindings: WorkerEnv }>) {
  let body: { ids?: unknown }
  try {
    body = (await c.req.json()) as { ids?: unknown }
  } catch {
    return c.json(fail('请求体不是合法 JSON'), 400)
  }

  const ids = parseIdList(body.ids)
  if (!ids) return c.json(fail('ids 必须是整数数组'), 400)

  await reorderNotes(c.env.DB, ids)
  return c.json(ok({ ok: true }))
}

function mapNote(row: NoteRow) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    disabled: row.disabled === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapNoteMeta(row: NoteRow) {
  return {
    id: row.id,
    title: row.title,
    disabled: row.disabled === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function noteFail(error: unknown): { message: string; status: 400 | 404 } {
  const message = error instanceof Error ? error.message : '操作失败'
  return { message, status: message === '笔记不存在' ? 404 : 400 }
}

function parseFilter(raw: string | undefined): TodoFilter {
  if (raw === 'active' || raw === 'completed' || raw === 'deleted' || raw === 'all') {
    return raw
  }
  return 'all'
}

api.get('/health', (c) => c.json(ok({ ok: true })))

api.get('/todos', async (c) => {
  const filter = parseFilter(c.req.query('filter'))
  const items = (await listTodos(c.env.DB, filter)).map(mapTodo)
  return c.json(ok({ items, counts: await getCounts(c.env.DB) }))
})

api.post('/todos', async (c) => {
  let body: { content?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json(fail('请求体不是合法 JSON'), 400)
  }

  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) return c.json(fail('内容不能为空'), 400)

  const row = await createTodo(c.env.DB, content)
  return c.json(ok(mapTodo(row)), 201)
})

api.post('/todos/import', async (c) => {
  let body: { text?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json(fail('请求体不是合法 JSON'), 400)
  }

  const text = typeof body.text === 'string' ? body.text : ''
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) return c.json(fail('没有可导入的内容'), 400)

  const rows = await createTodos(c.env.DB, lines)
  return c.json(ok({ items: rows.map(mapTodo), counts: await getCounts(c.env.DB) }), 201)
})

api.put('/todos/reorder', async (c) => {
  let body: { ids?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json(fail('请求体不是合法 JSON'), 400)
  }

  if (!Array.isArray(body.ids) || body.ids.some((id) => !Number.isInteger(id))) {
    return c.json(fail('ids 必须是整数数组'), 400)
  }

  await reorderTodos(c.env.DB, body.ids as number[])
  return c.json(ok({ ok: true }))
})

api.put('/todos/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json(fail('无效的 Todo ID'), 400)

  const existing = await getTodo(c.env.DB, id)
  if (!existing || existing.hidden === 1) return c.json(fail('Todo 不存在'), 404)

  let body: { content?: unknown; completed?: unknown; deleted?: unknown; priority?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json(fail('请求体不是合法 JSON'), 400)
  }

  const patch: {
    content?: string
    completed?: boolean
    deleted?: boolean
    priority?: 'P0' | 'P1' | 'P2' | 'P3' | null
  } = {}
  if (body.content != null) {
    if (typeof body.content !== 'string' || !body.content.trim()) {
      return c.json(fail('内容不能为空'), 400)
    }
    patch.content = body.content.trim()
  }
  if (body.completed != null) {
    if (typeof body.completed !== 'boolean') return c.json(fail('completed 必须是布尔值'), 400)
    patch.completed = body.completed
  }
  if (body.deleted != null) {
    if (typeof body.deleted !== 'boolean') return c.json(fail('deleted 必须是布尔值'), 400)
    patch.deleted = body.deleted
  }
  if (body.priority !== undefined) {
    if (body.priority === null) {
      patch.priority = null
    } else if (typeof body.priority === 'string' && PRIORITIES.has(body.priority)) {
      patch.priority = body.priority as 'P0' | 'P1' | 'P2' | 'P3'
    } else {
      return c.json(fail('priority 必须是 P0/P1/P2/P3 或 null'), 400)
    }
  }

  const row = await updateTodo(c.env.DB, id, patch)
  return c.json(ok(mapTodo(row!)))
})

api.delete('/todos/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json(fail('无效的 Todo ID'), 400)

  const existing = await getTodo(c.env.DB, id)
  if (!existing || existing.hidden === 1) return c.json(fail('Todo 不存在'), 404)
  if (existing.deleted === 1) return c.json(fail('任务已在回收站，请使用清除'), 400)

  const row = await softDeleteTodo(c.env.DB, id)
  return c.json(ok(mapTodo(row!)))
})

api.post('/todos/:id/purge', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json(fail('无效的 Todo ID'), 400)

  const existing = await getTodo(c.env.DB, id)
  if (!existing || existing.hidden === 1) return c.json(fail('Todo 不存在'), 404)
  if (existing.deleted !== 1) return c.json(fail('仅回收站任务可清除'), 400)

  const row = await purgeTodo(c.env.DB, id)
  return c.json(ok(mapTodo(row!)))
})

api.get('/notes', async (c) => {
  return c.json(ok({ items: (await listNotes(c.env.DB)).map(mapNoteMeta) }))
})

api.post('/notes', async (c) => {
  let body: { title?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json(fail('请求体不是合法 JSON'), 400)
  }

  const title = typeof body.title === 'string' ? body.title : ''
  try {
    const note = await createNote(c.env.DB, title)
    return c.json(ok(mapNote(note)), 201)
  } catch (error) {
    const result = noteFail(error)
    return c.json(fail(result.message), result.status)
  }
})

api.put('/notes/reorder', (c) => handleNoteReorder(c))

api.put('/notes/:id', async (c) => {
  if (c.req.param('id') === 'reorder') {
    return handleNoteReorder(c)
  }

  const id = parseId(c.req.param('id'))
  if (!id) return c.json(fail('无效的笔记 ID'), 400)

  let body: { title?: unknown; disabled?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json(fail('请求体不是合法 JSON'), 400)
  }

  const patch: { title?: string; disabled?: boolean } = {}
  if (body.title != null) {
    if (typeof body.title !== 'string') return c.json(fail('title 必须是字符串'), 400)
    patch.title = body.title
  }
  if (body.disabled != null) {
    if (typeof body.disabled !== 'boolean') return c.json(fail('disabled 必须是布尔值'), 400)
    patch.disabled = body.disabled
  }

  try {
    const note = await updateNote(c.env.DB, id, patch)
    return c.json(ok(mapNoteMeta(note)))
  } catch (error) {
    const result = noteFail(error)
    return c.json(fail(result.message), result.status)
  }
})

api.delete('/notes/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json(fail('无效的笔记 ID'), 400)

  try {
    const note = await deleteNote(c.env.DB, id)
    return c.json(ok(mapNoteMeta(note)))
  } catch (error) {
    const result = noteFail(error)
    return c.json(fail(result.message), result.status)
  }
})

api.get('/note', async (c) => {
  const raw = c.req.query('id')
  const id = raw ? parseId(raw) : null
  if (raw && !id) return c.json(fail('无效的笔记 ID'), 400)

  const note =
    (id ? await getNote(c.env.DB, id) : await getNote(c.env.DB)) ??
    (id ? undefined : await ensureDefaultNote(c.env.DB))
  if (!note) return c.json(fail('笔记不存在'), 404)
  return c.json(ok(mapNote(note)))
})

api.put('/note', async (c) => {
  let body: { id?: unknown; content?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json(fail('请求体不是合法 JSON'), 400)
  }

  if (typeof body.content !== 'string') {
    return c.json(fail('content 必须是字符串'), 400)
  }

  const id = body.id == null ? undefined : typeof body.id === 'number' ? body.id : Number(body.id)
  if (body.id != null && (!Number.isInteger(id) || (id as number) <= 0)) {
    return c.json(fail('无效的笔记 ID'), 400)
  }

  try {
    const note = await saveNote(c.env.DB, body.content, id)
    return c.json(ok(mapNote(note)))
  } catch (error) {
    const result = noteFail(error)
    return c.json(fail(result.message), result.status)
  }
})

api.post('/ai/v1/chat/completions', (c) => proxyChatCompletions(c))

api.get('/activity', async (c) => {
  const raw = Number(c.req.query('days') || 371)
  const days = Number.isFinite(raw) ? Math.min(Math.max(Math.floor(raw), 28), 400) : 371
  return c.json(
    ok({
      days: await listActivity(c.env.DB, days),
      month: await getMonthOverview(c.env.DB),
    }),
  )
})

api.get('/activity/logs', async (c) => {
  const raw = Number(c.req.query('limit') || 100)
  const limit = Number.isFinite(raw) ? raw : 100
  return c.json(ok({ items: await listOperationLogs(c.env.DB, limit) }))
})

api.get('/ai/calls', async (c) => {
  const raw = Number(c.req.query('limit') || 100)
  const limit = Number.isFinite(raw) ? raw : 100
  return c.json(ok({ items: await listAiCalls(c.env.DB, limit) }))
})

api.get('/ai/calls/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) return c.json(fail('无效的调用记录 ID'), 400)
  const item = await getAiCall(c.env.DB, id)
  if (!item) return c.json(fail('记录不存在'), 404)
  return c.json(ok(item))
})

api.get('/backup/export', async (c) => {
  try {
    const { filename, bytes } = await buildExportZip(c.env.DB, c.env.UPLOADS)
    return new Response(bytes, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(bytes.byteLength),
      },
    })
  } catch (error) {
    return c.json(fail(error instanceof Error ? error.message : '导出失败'), 500)
  }
})

api.post('/backup/import', async (c) => {
  try {
    const body = await c.req.parseBody()
    const file = body.file
    if (!(file instanceof File)) return c.json(fail('请上传 zip 备份文件'), 400)

    const name = file.name.toLowerCase()
    if (!name.endsWith('.zip')) return c.json(fail('仅支持 .zip 备份文件'), 400)

    const result = await importBackupZip(c.env.DB, c.env.UPLOADS, await file.arrayBuffer())
    return c.json(ok(result))
  } catch (error) {
    return c.json(fail(error instanceof Error ? error.message : '导入失败'), 400)
  }
})

api.post('/image/upload', async (c) => {
  try {
    const body = await c.req.parseBody()
    const file = body.image
    if (!(file instanceof File)) {
      return c.json({ errorCode: 1, errorMessage: '缺少图片文件' }, 400)
    }
    const saved = await saveUploadedImage(c.env.UPLOADS, file)
    return c.json({
      errorCode: 0,
      data: {
        src: saved.src,
        alt: file.name || 'image',
      },
    })
  } catch (error) {
    return c.json(
      {
        errorCode: 1,
        errorMessage: error instanceof Error ? error.message : '上传失败',
      },
      400,
    )
  }
})

api.get('/uploads/:name', async (c) => {
  const name = c.req.param('name')
  const obj = await getUploadedObject(c.env.UPLOADS, name)
  if (!obj) return c.json(fail('文件不存在'), 404)
  const headers = new Headers()
  headers.set('Content-Type', obj.httpMetadata?.contentType || contentTypeFor(name))
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  return new Response(obj.body, { headers })
})

export { api }
