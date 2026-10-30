import { describe, expect, it } from 'vitest'
import { filterRows, paginate, sortRows } from '@/lib/table'

const rows = [
  { name: 'Zoë', n: 3, d: null as string | null },
  { name: 'adam', n: 10, d: '2026-01-02' },
  { name: 'Bea', n: 2, d: '2025-05-01' },
]

describe('sortRows', () => {
  it('sorts case-insensitively and numerically', () => {
    expect(sortRows(rows, (r) => r.name, 'asc').map((r) => r.name)).toEqual(['adam', 'Bea', 'Zoë'])
    expect(sortRows(rows, (r) => r.n, 'desc').map((r) => r.n)).toEqual([10, 3, 2])
  })
  it('keeps empty values last in both directions', () => {
    expect(sortRows(rows, (r) => r.d, 'asc').map((r) => r.name)).toEqual(['Bea', 'adam', 'Zoë'])
    expect(sortRows(rows, (r) => r.d, 'desc').map((r) => r.name)).toEqual(['adam', 'Bea', 'Zoë'])
  })
  it('does not mutate its input', () => {
    const copy = [...rows]
    sortRows(rows, (r) => r.n, 'asc')
    expect(rows).toEqual(copy)
  })
})

describe('filterRows', () => {
  it('matches every term, ignoring case and accents', () => {
    expect(filterRows(rows, 'zoe', (r) => r.name).map((r) => r.name)).toEqual(['Zoë'])
    expect(filterRows(rows, '  ', (r) => r.name)).toHaveLength(3)
    expect(filterRows(rows, 'bea x', (r) => r.name)).toHaveLength(0)
  })
})

describe('paginate', () => {
  const many = Array.from({ length: 23 }, (_, i) => i)
  it('slices pages and reports ranges', () => {
    expect(paginate(many, 3, 10)).toMatchObject({
      rows: [20, 21, 22],
      page: 3,
      pageCount: 3,
      from: 21,
      to: 23,
      total: 23,
    })
  })
  it('clamps out-of-range pages', () => {
    expect(paginate(many, 99, 10).page).toBe(3)
    expect(paginate([], 1, 10)).toMatchObject({ pageCount: 1, from: 0, to: 0 })
  })
})
