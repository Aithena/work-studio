import { Hono } from 'hono'
import { api } from './app'
import {
  clearAccessCookie,
  hasValidAccess,
  loginPageHtml,
  requireAccess,
  setAccessCookie,
} from './auth'
import type { WorkerEnv } from './env'

const app = new Hono<{ Bindings: WorkerEnv }>()

app.get('/login', (c) => {
  if (!c.env.ACCESS_TOKEN?.trim()) {
    return c.redirect('/')
  }
  if (hasValidAccess(c)) {
    return c.redirect('/')
  }
  return c.html(loginPageHtml())
})

app.post('/auth/login', async (c) => {
  const expected = c.env.ACCESS_TOKEN?.trim()
  if (!expected) return c.redirect('/')

  const body = await c.req.parseBody()
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (token !== expected) {
    return c.html(loginPageHtml('口令不正确'), 401)
  }

  setAccessCookie(c, token)
  return c.redirect('/')
})

app.post('/auth/logout', (c) => {
  clearAccessCookie(c)
  return c.redirect('/login')
})

app.use('/api/*', async (c, next) => {
  if (new URL(c.req.url).pathname === '/api/health') {
    await next()
    return
  }
  return requireAccess(c, next)
})
app.route('/api', api)

app.use('*', requireAccess)

app.all('*', async (c) => {
  return c.env.ASSETS.fetch(c.req.raw)
})

export default app
