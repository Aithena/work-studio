const GALLERY_ORIGIN = 'https://pic.awall.cc'

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '')
}

export function galleryHandoffDenied(site: string | undefined): string | null {
  if (site !== 'same-origin') return '只能从工作台页面签发'
  return null
}

export async function signGalleryHandoff(secret: string, nowMs = Date.now()): Promise<string> {
  const exp = Math.floor(nowMs / 1000) + 60
  const payload = base64url(new TextEncoder().encode(JSON.stringify({ exp })))
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const sig = base64url(new Uint8Array(sigBuf))
  return `${GALLERY_ORIGIN}/#h=${payload}.${sig}`
}
