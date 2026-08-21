const KEY = 'workbench.split'
export const DEFAULT_SPLIT = 0.4
const MIN_LEFT = 280
const MIN_RIGHT = 420

export function readSplit(): number {
  const raw = Number(localStorage.getItem(KEY))
  if (Number.isFinite(raw) && raw > 0.18 && raw < 0.72) return raw
  return DEFAULT_SPLIT
}

export function persistSplit(ratio: number): void {
  localStorage.setItem(KEY, String(ratio))
}

export function clampSplit(ratio: number, width: number): number {
  const min = MIN_LEFT / width
  const max = 1 - MIN_RIGHT / width
  if (width < MIN_LEFT + MIN_RIGHT) return Math.min(Math.max(ratio, 0.28), 0.55)
  return Math.min(Math.max(ratio, min), max)
}
