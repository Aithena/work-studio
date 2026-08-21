import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { DATA_DIR } from './db'

export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads')

const MAX_BYTES = 12 * 1024 * 1024

const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
}

function dayStamp(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

export function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

export async function saveUploadedImage(file: File): Promise<{ src: string; filename: string }> {
  ensureUploadDir()

  const mime = (file.type || '').toLowerCase()
  const ext = MIME_EXT[mime]
  if (!ext) throw new Error('仅支持 JPG / PNG / GIF / WebP 图片')

  if (file.size <= 0) throw new Error('空文件')
  if (file.size > MAX_BYTES) throw new Error('图片不能超过 12MB')

  const filename = `${dayStamp()}-${randomBytes(8).toString('hex')}${ext}`
  const dest = path.join(UPLOAD_DIR, filename)
  const buffer = Buffer.from(await file.arrayBuffer())
  fs.writeFileSync(dest, buffer)

  return {
    filename,
    src: `/api/uploads/${filename}`,
  }
}

export function resolveUploadPath(name: string): string | null {
  const base = path.basename(name)
  if (!/^[a-zA-Z0-9._-]+$/.test(base)) return null
  const root = path.resolve(UPLOAD_DIR)
  const full = path.resolve(root, base)
  if (full !== root && !full.startsWith(root + path.sep)) return null
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null
  return full
}

export function contentTypeFor(name: string): string {
  const ext = path.extname(name).toLowerCase()
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.png') return 'image/png'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.webp') return 'image/webp'
  return 'application/octet-stream'
}
