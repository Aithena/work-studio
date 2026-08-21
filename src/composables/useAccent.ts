const KEY = 'workbench.accent'
export const DEFAULT_ACCENT = '#5B6AFF'

export const ACCENT_PRESETS = [
  '#5B6AFF',
  '#007AFF',
  '#DB4437',
  '#0F9D58',
  '#F4B400',
  '#9C27B0',
  '#FF6D00',
  '#00ACC1',
  '#E91E63',
  '#3949AB',
]

function isHex(value: string): boolean {
  return /^#([0-9a-fA-F]{6})$/.test(value)
}

export function readAccent(): string {
  const stored = localStorage.getItem(KEY)
  if (stored && isHex(stored)) return stored
  return DEFAULT_ACCENT
}

export function applyAccent(color: string): void {
  const next = isHex(color) ? color : DEFAULT_ACCENT
  const root = document.documentElement
  root.style.setProperty('--accent', next)
  root.style.setProperty('--accent-soft', `color-mix(in srgb, ${next} 14%, #ffffff)`)
  root.style.setProperty('--accent-hover', `color-mix(in srgb, ${next} 22%, #ffffff)`)
  localStorage.setItem(KEY, next)
}
