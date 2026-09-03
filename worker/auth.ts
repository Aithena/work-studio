import type { Context, Next } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { WorkerEnv } from './env'

export const ACCESS_COOKIE = 'work_access'

export function hasValidAccess(c: Context<{ Bindings: WorkerEnv }>): boolean {
  const expected = c.env.ACCESS_TOKEN?.trim()
  if (!expected) return true

  const auth = c.req.header('Authorization')
  if (auth?.startsWith('Bearer ') && auth.slice(7).trim() === expected) return true

  const cookie = getCookie(c, ACCESS_COOKIE)
  return cookie === expected
}

export async function requireAccess(
  c: Context<{ Bindings: WorkerEnv }>,
  next: Next,
): Promise<Response | void> {
  if (hasValidAccess(c)) {
    await next()
    return
  }

  const path = new URL(c.req.url).pathname
  if (path.startsWith('/api/')) {
    return c.json({ success: false, message: '未授权' }, 401)
  }
  return c.redirect('/login')
}

export function loginPageHtml(error = ''): string {
  const err = error
    ? `<p style="color:#c0392b;margin:0 0 12px;font-size:14px">${error}</p>`
    : ''
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>登录 · 我的工作台</title>
  <style>
    body { margin:0; min-height:100vh; display:grid; place-items:center;
      font-family: "Segoe UI", system-ui, sans-serif; background:#f4f5f7; color:#1f2937; }
    form { width:min(360px, calc(100vw - 32px)); background:#fff; border:1px solid #e5e7eb;
      border-radius:12px; padding:28px 24px; box-shadow:0 8px 24px rgba(15,23,42,.06); }
    h1 { margin:0 0 8px; font-size:20px; font-weight:650; }
    p.hint { margin:0 0 18px; color:#6b7280; font-size:13px; line-height:1.5; }
    input { width:100%; box-sizing:border-box; border:1px solid #d1d5db; border-radius:8px;
      padding:10px 12px; font-size:14px; margin-bottom:12px; }
    button { width:100%; border:0; border-radius:8px; padding:10px 12px; font-size:14px;
      font-weight:600; color:#fff; background:#2563eb; cursor:pointer; }
    button:hover { background:#1d4ed8; }
  </style>
</head>
<body>
  <form method="post" action="/auth/login">
    <h1>我的工作台</h1>
    <p class="hint">输入访问口令后继续。口令保存在本机 Cookie。</p>
    ${err}
    <input type="password" name="token" placeholder="访问口令" autocomplete="current-password" autofocus required />
    <button type="submit">进入</button>
  </form>
</body>
</html>`
}

export function setAccessCookie(c: Context<{ Bindings: WorkerEnv }>, token: string) {
  setCookie(c, ACCESS_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 365,
  })
}

export function clearAccessCookie(c: Context<{ Bindings: WorkerEnv }>) {
  deleteCookie(c, ACCESS_COOKIE, { path: '/' })
}
