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

function randomHex(bytes = 8): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function isSafeUploadName(name: string): boolean {
  const base = name.split('/').pop() || name
  return /^[a-zA-Z0-9._-]+$/.test(base)
}

export async function saveUploadedImage(
  bucket: R2Bucket,
  file: File,
): Promise<{ src: string; filename: string }> {
  const mime = (file.type || '').toLowerCase()
  const ext = MIME_EXT[mime]
  if (!ext) throw new Error('仅支持 JPG / PNG / GIF / WebP 图片')

  if (file.size <= 0) throw new Error('空文件')
  if (file.size > MAX_BYTES) throw new Error('图片不能超过 12MB')

  const filename = `${dayStamp()}-${randomHex(8)}${ext}`
  await bucket.put(filename, await file.arrayBuffer(), {
    httpMetadata: { contentType: mime },
  })

  return {
    filename,
    src: `/api/uploads/${filename}`,
  }
}

export async function getUploadedObject(
  bucket: R2Bucket,
  name: string,
): Promise<R2ObjectBody | null> {
  const base = name.split('/').pop() || name
  if (!isSafeUploadName(base)) return null
  return bucket.get(base)
}

export function contentTypeFor(name: string): string {
  const ext = name.toLowerCase().slice(name.lastIndexOf('.'))
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.png') return 'image/png'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.webp') return 'image/webp'
  return 'application/octet-stream'
}
