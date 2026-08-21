import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { getDb, type TodoRow } from './db'
import { proxyChatCompletions } from './ai'
import { listActivity, getMonthOverview, listOperationLogs } from './activity'
import { getNote, saveNote } from './notes'
import { ensureDailyBackup, buildExportPayload, importBackupPayload } from './backup'
import {
  contentTypeFor,
  resolveUploadPath,
  saveUploadedImage,
  ensureUploadDir,
} from './uploads'
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

const app = new Hono()

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

function parseFilter(raw: string | undefined): TodoFilter {
  if (raw === 'active' || raw === 'completed' || raw === 'deleted' || raw === 'all') {
    return raw
  }
  return 'all'
}

getDb()

app.get('/api/health', (c) => c.json(ok({ ok: true })))

app.get('/api/todos', (c) => {
  const filter = parseFilter(c.req.query('filter'))
  const items = listTodos(filter).map(mapTodo)
  return c.json(ok({ items, counts: getCounts() }))
})

app.post('/api/todos', async (c) => {
  let body: { content?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json(fail('请求体不是合法 JSON'), 400)
  }

  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) return c.json(fail('内容不能为空'), 400)

  const row = createTodo(content)
  return c.json(ok(mapTodo(row)), 201)
})

app.post('/api/todos/import', async (c) => {
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

  const rows = createTodos(lines)
  return c.json(ok({ items: rows.map(mapTodo), counts: getCounts() }), 201)
})

app.put('/api/todos/reorder', async (c) => {
  let body: { ids?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json(fail('请求体不是合法 JSON'), 400)
  }

  if (!Array.isArray(body.ids) || body.ids.some((id) => !Number.isInteger(id))) {
    return c.json(fail('ids 必须是整数数组'), 400)
  }

  reorderTodos(body.ids as number[])
  return c.json(ok({ ok: true }))
})

app.put('/api/todos/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json(fail('无效的 Todo ID'), 400)

  const existing = getTodo(id)
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

  const row = updateTodo(id, patch)
  return c.json(ok(mapTodo(row!)))
})

app.delete('/api/todos/:id', (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json(fail('无效的 Todo ID'), 400)

  const existing = getTodo(id)
  if (!existing || existing.hidden === 1) return c.json(fail('Todo 不存在'), 404)
  if (existing.deleted === 1) return c.json(fail('任务已在回收站，请使用清除'), 400)

  const row = softDeleteTodo(id)
  return c.json(ok(mapTodo(row!)))
})

app.post('/api/todos/:id/purge', (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json(fail('无效的 Todo ID'), 400)

  const existing = getTodo(id)
  if (!existing || existing.hidden === 1) return c.json(fail('Todo 不存在'), 404)
  if (existing.deleted !== 1) return c.json(fail('仅回收站任务可清除'), 400)

  const row = purgeTodo(id)
  return c.json(ok(mapTodo(row!)))
})

app.get('/api/note', (c) => {
  const note = getNote()
  return c.json(
    ok({
      id: note.id,
      content: note.content,
      updatedAt: note.updated_at,
    }),
  )
})

app.put('/api/note', async (c) => {
  let body: { content?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json(fail('请求体不是合法 JSON'), 400)
  }

  if (typeof body.content !== 'string') {
    return c.json(fail('content 必须是字符串'), 400)
  }

  const note = saveNote(body.content)
  return c.json(
    ok({
      id: note.id,
      content: note.content,
      updatedAt: note.updated_at,
    }),
  )
})

app.post('/api/ai/v1/chat/completions', (c) => proxyChatCompletions(c))

app.get('/api/activity', (c) => {
  const raw = Number(c.req.query('days') || 371)
  const days = Number.isFinite(raw) ? Math.min(Math.max(Math.floor(raw), 28), 400) : 371
  return c.json(
    ok({
      days: listActivity(days),
      month: getMonthOverview(),
    }),
  )
})

app.get('/api/activity/logs', (c) => {
  const raw = Number(c.req.query('limit') || 100)
  const limit = Number.isFinite(raw) ? raw : 100
  return c.json(ok({ items: listOperationLogs(limit) }))
})

app.get('/api/backup/export', (c) => {
  const payload = buildExportPayload()
  const day = payload.exportedAt.slice(0, 10)
  const filename = `workbench-backup-${day}.json`
  return c.json(ok({ filename, payload }))
})

app.post('/api/backup/import', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(fail('请求体不是合法 JSON'), 400)
  }

  try {
    const result = importBackupPayload(body)
    return c.json(ok(result))
  } catch (error) {
    return c.json(fail(error instanceof Error ? error.message : '导入失败'), 400)
  }
})

/** AiEditor 要求直接返回 errorCode 结构，不走统一 { success } 包裹 */
app.post('/api/image/upload', async (c) => {
  try {
    const body = await c.req.parseBody()
    const file = body.image
    if (!(file instanceof File)) {
      return c.json({ errorCode: 1, errorMessage: '缺少图片文件' }, 400)
    }
    const saved = await saveUploadedImage(file)
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

app.get('/api/uploads/:name', (c) => {
  const name = c.req.param('name')
  const full = resolveUploadPath(name)
  if (!full) return c.json(fail('文件不存在'), 404)
  const buf = fs.readFileSync(full)
  return new Response(buf, {
    headers: {
      'Content-Type': contentTypeFor(name),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
})

if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist' }))
  app.get('*', (c) => {
    const indexPath = path.join(process.cwd(), 'dist', 'index.html')
    return c.html(fs.readFileSync(indexPath, 'utf8'))
  })
}

const port = Number(process.env.PORT || 8787)

ensureUploadDir()
ensureDailyBackup()

serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, (info) => {
  console.log(`[work-studio] http://127.0.0.1:${info.port}`)
})
