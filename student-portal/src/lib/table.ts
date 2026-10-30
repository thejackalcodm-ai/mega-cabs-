export type SortDirection = 'asc' | 'desc'
export interface SortState {
  columnId: string
  direction: SortDirection
}

export type Sortable = string | number | boolean | Date | null | undefined

function compare(a: Sortable, b: Sortable): number {
  // nulls always last regardless of direction is handled by the caller
  if (a instanceof Date) a = a.getTime()
  if (b instanceof Date) b = b.getTime()
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

export function sortRows<T>(
  rows: readonly T[],
  getValue: (row: T) => Sortable,
  direction: SortDirection,
): T[] {
  return [...rows].sort((ra, rb) => {
    const a = getValue(ra)
    const b = getValue(rb)
    const aNull = a === null || a === undefined || a === ''
    const bNull = b === null || b === undefined || b === ''
    if (aNull && bNull) return 0
    if (aNull) return 1
    if (bNull) return -1
    const c = compare(a, b)
    return direction === 'asc' ? c : -c
  })
}

/** Case- and accent-insensitive "every word appears somewhere in the row" search. */
export function filterRows<T>(rows: readonly T[], query: string, getText: (row: T) => string): T[] {
  const norm = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const terms = norm(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return [...rows]
  return rows.filter((row) => {
    const text = norm(getText(row))
    return terms.every((t) => text.includes(t))
  })
}

export function paginate<T>(rows: readonly T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(Math.max(1, page), pageCount)
  const start = (current - 1) * pageSize
  return {
    rows: rows.slice(start, start + pageSize),
    page: current,
    pageCount,
    total: rows.length,
    from: rows.length === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, rows.length),
  }
}
