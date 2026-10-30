import { createHash } from 'node:crypto'

const NAMESPACE = 'meridian-demo-seed-v1'

/** Deterministic UUID (v5-style) so every run of the seed targets the same rows. */
export function sid(...parts: (string | number)[]): string {
  const h = createHash('sha1')
    .update(`${NAMESPACE}:${parts.join(':')}`)
    .digest()
  h[6] = (h[6] & 0x0f) | 0x50
  h[8] = (h[8] & 0x3f) | 0x80
  const hex = h.subarray(0, 16).toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

export const daysFromNow = (days: number, hour = 10) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  d.setUTCHours(hour, 0, 0, 0)
  return d.toISOString()
}
export const dateFromNow = (days: number) => daysFromNow(days).slice(0, 10)
