import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, Info } from 'lucide-react'
import { useCurrentUser } from '@/app/providers/auth-context'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PreviewDialog } from '@/features/documents/PreviewDialog'
import { documentKeys, useDocumentTypes } from '@/features/documents/queries'
import { DOCUMENT_CATEGORY_LABEL } from '@/lib/constants'
import { formatDateTime, timeAgo } from '@/lib/format'
import { fetchReviewQueue, type QueueItem } from '@/services/documents'
import type { Enums } from '@/types/database'

/** Documents waiting for review. Counselors see their assigned students only (enforced by RLS). */
export function DocumentQueuePage() {
  const user = useCurrentUser()
  const types = useDocumentTypes()
  const queue = useQuery({
    queryKey: documentKeys.queue,
    queryFn: () => fetchReviewQueue(types.data!),
    enabled: !!types.data,
  })
  const [category, setCategory] = useState<Enums<'document_category'> | ''>('')
  const [preview, setPreview] = useState<{ documentId: string; title: string } | null>(null)
  const rows = useMemo(
    () => (queue.data ?? []).filter((r) => !category || r.category === category),
    [queue.data, category],
  )

  const columns: Column<QueueItem>[] = [
    {
      id: 'student',
      header: 'Student',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{r.studentName || '—'}</p>
          <p className="tabular text-xs text-muted-foreground">{r.studentNumber}</p>
        </div>
      ),
      sortValue: (r) => r.studentName,
      searchValue: (r) => `${r.studentName} ${r.studentNumber}`,
    },
    {
      id: 'document',
      header: 'Document',
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate">{r.typeName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {r.fileName} · v{r.version}
          </p>
        </div>
      ),
      sortValue: (r) => r.typeName,
      searchValue: (r) => `${r.typeName} ${r.fileName}`,
    },
    {
      id: 'category',
      header: 'Category',
      cell: (r) => DOCUMENT_CATEGORY_LABEL[r.category],
      sortValue: (r) => r.category,
      hideBelow: 'md',
    },
    {
      id: 'uploaded',
      header: 'Uploaded',
      cell: (r) => (
        <span title={formatDateTime(r.uploadedAt)} className="whitespace-nowrap">
          {timeAgo(r.uploadedAt)}
        </span>
      ),
      sortValue: (r) => r.uploadedAt,
      hideBelow: 'sm',
    },
    { id: 'status', header: 'Status', cell: (r) => <StatusBadge kind="document" status={r.status} /> },
    {
      id: 'actions',
      header: '',
      cell: (r) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setPreview({ documentId: r.id, title: `${r.typeName} · ${r.studentName}` })}
          aria-label={`Preview ${r.typeName} for ${r.studentName}`}
        >
          <Eye /> Preview
        </Button>
      ),
      className: 'text-right',
    },
  ]

  return (
    <>
      <PageHeader
        title="Document review queue"
        description={
          user.primaryRole === 'counselor'
            ? 'Documents from your assigned students, oldest first.'
            : 'Documents awaiting review, oldest first.'
        }
      />
      <p className="mb-4 flex items-start gap-2 rounded-md border bg-surface px-3 py-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        Approve, reject and request-resubmission actions arrive with the review workspace in Phase 4. Every
        preview here is recorded in the audit log.
      </p>
      <DataTable
        caption="Documents awaiting review"
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        isLoading={types.isPending || queue.isPending}
        error={types.error ?? queue.error}
        onRetry={() => void (types.isError ? types.refetch() : queue.refetch())}
        searchPlaceholder="Search student or document"
        initialSort={{ columnId: 'uploaded', direction: 'asc' }}
        pageSize={15}
        empty={{ title: 'Nothing to review', description: 'New uploads from students will appear here.' }}
        toolbar={
          <NativeSelect
            aria-label="Filter by category"
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            className="sm:w-48"
          >
            <option value="">All categories</option>
            {Object.entries(DOCUMENT_CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
        }
      />
      <PreviewDialog target={preview} onClose={() => setPreview(null)} />
    </>
  )
}
