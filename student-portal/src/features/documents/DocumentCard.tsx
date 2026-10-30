import { useState } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  Download,
  Eye,
  FileText,
  History,
  RefreshCcw,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { downloadDocument } from '@/features/documents/queries'
import { DOCUMENT_CATEGORY_LABEL, DOCUMENT_STATUS } from '@/lib/constants'
import {
  canStudentDelete,
  documentTitle,
  canStudentReplace,
  effectiveStatus,
  expiryState,
  needsAction,
} from '@/lib/documents'
import { formatBytes } from '@/lib/files'
import { formatDate, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { StudentDocument } from '@/services/documents'

interface Props {
  doc: StudentDocument
  highlighted?: boolean
  onPreview: (version?: number) => void
  onReplace: () => void
  onDelete: () => void
}

export function DocumentCard({ doc, highlighted, onPreview, onReplace, onDelete }: Props) {
  const [showHistory, setShowHistory] = useState(false)
  const status = effectiveStatus(doc.status, doc.expiry_date)
  const expiry = expiryState(doc.expiry_date)
  const title = documentTitle(doc)
  const actionNeeded = needsAction(status)

  return (
    <Card
      id={`doc-${doc.id}`}
      className={cn(
        'scroll-mt-24 p-4 transition-shadow',
        highlighted && 'ring-2 ring-[hsl(var(--brass))]',
        actionNeeded && 'border-status-danger/30',
      )}
      aria-label={`${title}, ${DOCUMENT_STATUS[status].label}`}
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
          <FileText className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{title}</h3>
            <StatusBadge kind="document" status={status} />
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {doc.file_name} · {formatBytes(doc.file_size)} · version {doc.version}
          </p>
          <p className="text-xs text-muted-foreground">
            {DOCUMENT_CATEGORY_LABEL[doc.category]} · uploaded {formatDate(doc.uploaded_at)}
            {doc.verified_at && ` · verified ${formatDate(doc.verified_at)}`}
            {expiry.kind !== 'none' && (
              <span
                className={cn(
                  expiry.kind === 'soon' && 'font-medium text-status-warning',
                  expiry.kind === 'expired' && 'font-medium text-status-danger',
                )}
              >
                {' · '}
                {expiry.kind === 'expired'
                  ? `expired ${formatDate(doc.expiry_date)}`
                  : `expires ${formatDate(doc.expiry_date)}`}
                {expiry.kind === 'soon' && ` (in ${expiry.days} day${expiry.days === 1 ? '' : 's'})`}
              </span>
            )}
          </p>
        </div>
      </div>

      {actionNeeded && (
        <div
          role="note"
          className="mt-3 space-y-1.5 rounded-md border border-status-danger/25 bg-status-danger-soft p-3 text-sm"
        >
          <p className="flex items-center gap-1.5 font-semibold text-status-danger">
            <AlertTriangle className="size-4" aria-hidden />
            {status === 'expired'
              ? 'This document has expired'
              : status === 'rejected'
                ? 'Document rejected'
                : 'Resubmission required'}
          </p>
          {doc.rejection_reason && (
            <p>
              <span className="font-medium">Reason:</span> {doc.rejection_reason}
            </p>
          )}
          <p>
            <span className="font-medium">Required action:</span>{' '}
            {doc.required_action ??
              (status === 'expired' ? 'Upload a valid, unexpired copy.' : 'Upload a corrected replacement.')}
          </p>
          {doc.reviewer_comment && (
            <p>
              <span className="font-medium">Reviewer comments:</span> {doc.reviewer_comment}
            </p>
          )}
          {doc.reviewed_at && (
            <p className="text-xs text-muted-foreground">
              Reviewed {formatDateTime(doc.reviewed_at)}
              {doc.reviewerName && ` by ${doc.reviewerName}`}
            </p>
          )}
        </div>
      )}
      {!actionNeeded && doc.reviewer_comment && (
        <p className="mt-3 rounded-md bg-muted/60 px-3 py-2 text-sm">
          <span className="font-medium">Reviewer comments:</span> {doc.reviewer_comment}
          {doc.reviewerName && <span className="text-muted-foreground"> · {doc.reviewerName}</span>}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {actionNeeded && canStudentReplace(doc.status) && (
          <Button size="sm" onClick={onReplace}>
            <RefreshCcw /> Upload replacement
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => onPreview()} aria-label={`Preview ${title}`}>
          <Eye /> Preview
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void downloadDocument(doc.id)}
          aria-label={`Download ${title}`}
        >
          <Download /> Download
        </Button>
        {!actionNeeded && canStudentReplace(doc.status) && (
          <Button size="sm" variant="outline" onClick={onReplace} aria-label={`Replace ${title}`}>
            <RefreshCcw /> Replace
          </Button>
        )}
        {canStudentDelete(doc.status) && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
            aria-label={`Delete ${title}`}
          >
            <Trash2 /> Delete
          </Button>
        )}
        {(doc.versions.length > 1 || doc.reviews.length > 0) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowHistory((v) => !v)}
            aria-expanded={showHistory}
            className="ml-auto"
          >
            <History /> History{' '}
            <ChevronDown className={cn('transition-transform', showHistory && 'rotate-180')} />
          </Button>
        )}
      </div>

      {showHistory && (
        <div className="mt-3 grid gap-4 border-t pt-3 sm:grid-cols-2">
          <section aria-label="Versions">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Versions
            </h4>
            <ul className="space-y-1.5">
              {doc.versions.map((v) => (
                <li key={v.id} className="flex items-center gap-2 text-sm">
                  <span className="tabular w-8 text-muted-foreground">v{v.version}</span>
                  <span className="min-w-0 flex-1 truncate">{v.file_name}</span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {formatDate(v.created_at)}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => onPreview(v.version)}
                    aria-label={`Preview version ${v.version}`}
                  >
                    <Eye />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => void downloadDocument(doc.id, v.version)}
                    aria-label={`Download version ${v.version}`}
                  >
                    <Download />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
          <section aria-label="Review history">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Reviews
            </h4>
            {doc.reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not reviewed yet.</p>
            ) : (
              <ul className="space-y-2">
                {doc.reviews.map((r) => (
                  <li key={r.id} className="text-sm">
                    <StatusBadge kind="document" status={r.action} />{' '}
                    <span className="text-xs text-muted-foreground">
                      v{r.version} · {formatDateTime(r.created_at)}
                      {r.reviewerName && ` · ${r.reviewerName}`}
                    </span>
                    {(r.reason || r.comment) && (
                      <p className="mt-0.5 text-muted-foreground">
                        {[r.reason, r.comment].filter(Boolean).join(' — ')}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Card>
  )
}
