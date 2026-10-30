import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { TableSkeleton } from '@/components/shared/Skeletons'
import { filterRows, paginate, sortRows, type Sortable, type SortState } from '@/lib/table'
import { cn } from '@/lib/utils'

export interface Column<T> {
  id: string
  header: string
  cell: (row: T) => React.ReactNode
  /** Enables sorting on this column. */
  sortValue?: (row: T) => Sortable
  /** Text included in the search filter. */
  searchValue?: (row: T) => string
  className?: string
  /** Hide on narrow screens. */
  hideBelow?: 'sm' | 'md' | 'lg'
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[] | undefined
  getRowId: (row: T) => string
  isLoading?: boolean
  error?: unknown
  onRetry?: () => void
  searchPlaceholder?: string
  pageSize?: number
  initialSort?: SortState
  empty?: { title: string; description?: string; action?: React.ReactNode }
  onRowClick?: (row: T) => void
  toolbar?: React.ReactNode
  caption?: string
}

const hideClass = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' }

export function DataTable<T>({
  columns,
  data,
  getRowId,
  isLoading,
  error,
  onRetry,
  searchPlaceholder = 'Search…',
  pageSize = 10,
  initialSort,
  empty = { title: 'Nothing here yet' },
  onRowClick,
  toolbar,
  caption,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortState | undefined>(initialSort)
  const [page, setPage] = useState(1)
  const searchable = columns.some((c) => c.searchValue)

  const view = useMemo(() => {
    let rows = data ?? []
    if (query) rows = filterRows(rows, query, (r) => columns.map((c) => c.searchValue?.(r) ?? '').join(' '))
    const sortCol = sort && columns.find((c) => c.id === sort.columnId)
    if (sort && sortCol?.sortValue) rows = sortRows(rows, sortCol.sortValue, sort.direction)
    return paginate(rows, page, pageSize)
  }, [data, query, sort, page, pageSize, columns])

  function toggleSort(id: string) {
    setSort((s) =>
      s?.columnId === id
        ? { columnId: id, direction: s.direction === 'asc' ? 'desc' : 'asc' }
        : { columnId: id, direction: 'asc' },
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-card">
      {(searchable || toolbar) && (
        <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center">
          {searchable && (
            <div className="relative sm:max-w-xs sm:flex-1">
              <Search
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(1)
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="pl-9"
              />
            </div>
          )}
          {toolbar && <div className="flex flex-wrap gap-2 sm:ml-auto">{toolbar}</div>}
        </div>
      )}

      {isLoading ? (
        <TableSkeleton columns={Math.min(columns.length, 4)} />
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} compact />
      ) : view.total === 0 ? (
        query ? (
          <EmptyState compact title="No matches" description={`Nothing matches “${query}”.`} />
        ) : (
          <EmptyState compact {...empty} />
        )
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            {caption && <caption className="sr-only">{caption}</caption>}
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {columns.map((c) => {
                  const active = sort?.columnId === c.id
                  return (
                    <th
                      key={c.id}
                      scope="col"
                      aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                      className={cn(
                        'whitespace-nowrap px-4 py-2.5 font-medium',
                        c.hideBelow && hideClass[c.hideBelow],
                        c.className,
                      )}
                    >
                      {c.sortValue ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(c.id)}
                          className="inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {c.header}
                          {active ? (
                            sort.direction === 'asc' ? (
                              <ArrowUp className="size-3.5" />
                            ) : (
                              <ArrowDown className="size-3.5" />
                            )
                          ) : (
                            <ChevronsUpDown className="size-3.5 opacity-50" />
                          )}
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y">
              {view.rows.map((row) => (
                <tr
                  key={getRowId(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cn(
                    onRowClick &&
                      'cursor-pointer hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none',
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c.id}
                      className={cn(
                        'px-4 py-3 align-middle',
                        c.hideBelow && hideClass[c.hideBelow],
                        c.className,
                      )}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && !error && view.total > pageSize && (
        <div className="flex items-center justify-between gap-2 border-t px-4 py-2.5 text-sm text-muted-foreground">
          <span className="tabular">
            {view.from}–{view.to} of {view.total}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage(view.page - 1)}
              disabled={view.page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage(view.page + 1)}
              disabled={view.page >= view.pageCount}
              aria-label="Next page"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
