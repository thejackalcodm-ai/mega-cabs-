import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, CheckCircle2, Download, FileText, Loader2, RefreshCcw, XCircle } from 'lucide-react'
import { useCurrentUser } from '@/app/providers/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { FormField } from '@/components/shared/FormField'
import { PageHeader } from '@/components/shared/PageHeader'
import { CardSkeleton } from '@/components/shared/Skeletons'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { adminKeys, useReviewDocument, useStudentSummary } from '@/features/admin/queries'
import { reviewSchema, type ReviewValues } from '@/features/admin/students/schemas'
import { downloadDocument, useStudentDocuments } from '@/features/documents/queries'
import { DOCUMENT_CATEGORY_LABEL } from '@/lib/constants'
import { formatBytes } from '@/lib/files'
import { formatDate, formatDateTime, timeAgo } from '@/lib/format'
import { hasAnyRole } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { fetchDocumentForReview, fetchEntityAudit } from '@/services/admin'
import { getDocumentUrl, type StudentDocument } from '@/services/documents'

/** Review workspace for one document: preview, metadata, history and the decision. */
export function DocumentReviewPage() {
  const { documentId = '' } = useParams()
  const owner = useQuery({
    queryKey: ['documents', 'owner', documentId],
    queryFn: () => fetchDocumentForReview(documentId),
  })
  const back = (
    <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
      <Link to="/admin/documents">
        <ArrowLeft /> Review queue
      </Link>
    </Button>
  )
  if (owner.isPending)
    return (
      <>
        {back}
        <CardSkeleton lines={4} />
      </>
    )
  if (owner.isError)
    return (
      <>
        {back}
        <Card>
          <ErrorState error={owner.error} onRetry={() => void owner.refetch()} />
        </Card>
      </>
    )
  if (!owner.data)
    return (
      <>
        {back}
        <Card>
          <EmptyState
            icon={FileText}
            title="Document not found"
            description="It may have been deleted, or the student isn't assigned to you."
          />
        </Card>
      </>
    )
  return <Workspace documentId={documentId} studentId={owner.data} back={back} />
}

function Workspace({
  documentId,
  studentId,
  back,
}: {
  documentId: string
  studentId: string
  back: React.ReactNode
}) {
  const user = useCurrentUser()
  const docs = useStudentDocuments(studentId)
  const student = useStudentSummary(studentId)
  const doc = docs.data?.find((d) => d.id === documentId)
  const [version, setVersion] = useState<number | undefined>()
  useEffect(() => setVersion(undefined), [doc?.version])

  if (docs.isPending)
    return (
      <>
        {back}
        <CardSkeleton lines={6} />
      </>
    )
  if (docs.isError)
    return (
      <>
        {back}
        <Card>
          <ErrorState error={docs.error} onRetry={() => void docs.refetch()} />
        </Card>
      </>
    )
  if (!doc)
    return (
      <>
        {back}
        <Card>
          <EmptyState icon={FileText} title="Document not found" />
        </Card>
      </>
    )
  const name = doc.custom_type_name ?? doc.type?.name ?? 'Document'
  const shown = version ?? doc.version

  return (
    <>
      {back}
      <PageHeader
        title={name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusBadge kind="document" status={doc.status} />
            <span>
              {student.data ? (
                <Link to={`/admin/students/${studentId}?tab=documents`} className="hover:underline">
                  {student.data.name} · {student.data.studentNumber}
                </Link>
              ) : (
                'Loading student…'
              )}
            </span>
            <span>Version {doc.version}</span>
          </span>
        }
      />
      <div className="grid gap-5 xl:grid-cols-5">
        <div className="space-y-5 xl:col-span-3">
          <InlinePreview documentId={doc.id} version={shown} />
          <VersionHistory doc={doc} shown={shown} onShow={setVersion} />
        </div>
        <div className="space-y-5 xl:col-span-2">
          <DecisionCard doc={doc} studentId={studentId} />
          <MetadataCard doc={doc} />
          <ReviewHistory doc={doc} />
          {hasAnyRole(user.roles, ['admin', 'super_admin']) && <DocumentAudit documentId={doc.id} />}
        </div>
      </div>
    </>
  )
}

/** Each load requests a new audited grant and a 60-second signed URL. */
function InlinePreview({ documentId, version }: { documentId: string; version: number }) {
  const file = useQuery({
    queryKey: ['document-preview', documentId, version],
    queryFn: () => getDocumentUrl(documentId, 'view', version),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const isPdf = file.data?.mimeType === 'application/pdf'
  const isImage = file.data?.mimeType.startsWith('image/')
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <p className="truncate text-sm font-medium">
          {file.data ? `${file.data.fileName} · version ${file.data.version}` : `Version ${version}`}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void downloadDocument(documentId, version)}
          disabled={!file.data}
        >
          <Download /> Download
        </Button>
      </div>
      <div className="h-[60dvh] min-h-80 bg-muted/40">
        {file.isPending ? (
          <Skeleton className="h-full w-full rounded-none" />
        ) : file.isError ? (
          <ErrorState error={file.error} title="Preview unavailable" onRetry={() => void file.refetch()} />
        ) : isPdf ? (
          <iframe
            title={`Preview of ${file.data.fileName}`}
            src={file.data.url}
            className="h-full w-full bg-white"
          />
        ) : isImage ? (
          <img
            src={file.data.url}
            alt={`Preview of ${file.data.fileName}`}
            className="h-full w-full object-contain"
          />
        ) : (
          <EmptyState
            icon={FileText}
            title="No preview for this file type"
            description="Download the file to open it."
          />
        )}
      </div>
    </Card>
  )
}

const ACTIONS = [
  { value: 'approved', label: 'Approve', icon: CheckCircle2 },
  { value: 'resubmission_required', label: 'Request resubmission', icon: RefreshCcw },
  { value: 'rejected', label: 'Reject', icon: XCircle },
] as const

function DecisionCard({ doc, studentId }: { doc: StudentDocument; studentId: string }) {
  const review = useReviewDocument(studentId)
  const form = useForm<ReviewValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { action: 'approved', comment: '' } as ReviewValues,
  })
  const action = form.watch('action')
  const needsReason = action === 'rejected' || action === 'resubmission_required'
  const errors = form.formState.errors as Partial<
    Record<'reason' | 'requiredAction' | 'comment', { message?: string }>
  >
  useEffect(() => {
    form.reset({ action: 'approved', comment: '' } as ReviewValues)
  }, [doc.id, doc.version, doc.status, form])

  const submit = form.handleSubmit(async (v) => {
    await review
      .mutateAsync({
        documentId: doc.id,
        action: v.action,
        comment: v.comment,
        ...(v.action !== 'approved' && { reason: v.reason, requiredAction: v.requiredAction }),
      })
      .catch(() => undefined)
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Decision</CardTitle>
      </CardHeader>
      <CardContent>
        {doc.status === 'approved' && (
          <p className="mb-3 rounded-md border border-status-success/30 bg-status-success-soft px-3 py-2 text-sm text-status-success">
            Version {doc.version} was approved {doc.reviewed_at ? timeAgo(doc.reviewed_at) : ''}. A new
            decision replaces it.
          </p>
        )}
        <form onSubmit={submit} className="space-y-4" noValidate>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Outcome</legend>
            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              {ACTIONS.map((a) => (
                <label
                  key={a.value}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                    action === a.value && 'border-primary bg-primary-soft font-medium',
                  )}
                >
                  <input type="radio" value={a.value} className="sr-only" {...form.register('action')} />
                  <a.icon className="size-4" aria-hidden /> {a.label}
                </label>
              ))}
            </div>
          </fieldset>
          {needsReason && (
            <>
              <FormField
                label="Reason"
                required
                error={errors.reason?.message}
                hint="The student sees this exactly as written."
              >
                <Textarea rows={3} maxLength={500} {...form.register('reason')} />
              </FormField>
              <FormField
                label="What the student should do"
                error={errors.requiredAction?.message}
                hint='Leave empty for "Upload a corrected replacement document".'
              >
                <Input maxLength={500} {...form.register('requiredAction')} />
              </FormField>
            </>
          )}
          <FormField label="Comment" error={errors.comment?.message} hint="Optional. Visible to the student.">
            <Textarea rows={2} maxLength={1000} {...form.register('comment')} />
          </FormField>
          <Button
            type="submit"
            className="w-full"
            variant={needsReason ? 'destructive' : 'default'}
            disabled={review.isPending}
          >
            {review.isPending && <Loader2 className="animate-spin" />}
            {ACTIONS.find((a) => a.value === action)?.label}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function MetadataCard({ doc }: { doc: StudentDocument }) {
  const rows: [string, React.ReactNode][] = [
    ['Category', DOCUMENT_CATEGORY_LABEL[doc.category]],
    ['File', doc.file_name],
    ['Type', doc.mime_type],
    ['Size', formatBytes(doc.file_size)],
    ['Uploaded', formatDateTime(doc.uploaded_at)],
    ['Expires', doc.expiry_date ? formatDate(doc.expiry_date) : 'No expiry'],
    ['Reviewer', doc.reviewerName ?? '—'],
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Details</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="min-w-0 truncate">{v}</dd>
            </div>
          ))}
        </dl>
        {doc.rejection_reason && (
          <div className="mt-4 space-y-1 rounded-md border border-status-danger/30 bg-status-danger-soft px-3 py-2 text-sm text-status-danger">
            <p>
              <strong>Reason:</strong> {doc.rejection_reason}
            </p>
            {doc.required_action && (
              <p>
                <strong>Required action:</strong> {doc.required_action}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function VersionHistory({
  doc,
  shown,
  onShow,
}: {
  doc: StudentDocument
  shown: number
  onShow: (v: number) => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Version history</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="divide-y">
          {doc.versions.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  Version {v.version}{' '}
                  {v.version === doc.version && (
                    <span className="font-normal text-muted-foreground">(current)</span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {v.file_name} · {formatBytes(v.file_size)} · {formatDateTime(v.created_at)}
                </p>
              </div>
              <Button
                size="sm"
                variant={shown === v.version ? 'secondary' : 'outline'}
                onClick={() => onShow(v.version)}
                aria-pressed={shown === v.version}
              >
                {shown === v.version ? 'Showing' : 'View'}
              </Button>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}

function ReviewHistory({ doc }: { doc: StudentDocument }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Previous reviews</CardTitle>
      </CardHeader>
      <CardContent>
        {doc.reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not reviewed yet.</p>
        ) : (
          <ol className="space-y-3">
            {doc.reviews.map((r) => (
              <li key={r.id} className="text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    kind="document"
                    status={r.action === 'under_review' ? 'under_review' : r.action}
                  />
                  <span className="text-xs text-muted-foreground">
                    v{r.version} · {r.reviewerName ?? 'Staff'} · {formatDateTime(r.created_at)}
                  </span>
                </div>
                {r.reason && <p className="mt-1">{r.reason}</p>}
                {r.comment && <p className="mt-1 text-muted-foreground">{r.comment}</p>}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

function DocumentAudit({ documentId }: { documentId: string }) {
  const q = useQuery({
    queryKey: adminKeys.documentAudit(documentId),
    queryFn: () => fetchEntityAudit(documentId),
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Audit trail</CardTitle>
      </CardHeader>
      <CardContent>
        {q.isPending ? (
          <CardSkeleton lines={3} />
        ) : q.isError ? (
          <ErrorState compact error={q.error} onRetry={() => void q.refetch()} />
        ) : q.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No entries.</p>
        ) : (
          <ol className="max-h-72 space-y-2 overflow-auto text-xs">
            {q.data.map((a) => (
              <li key={a.id} className="flex justify-between gap-3">
                <span className="font-mono">{a.action}</span>
                <span className="shrink-0 text-muted-foreground">
                  {a.actorName ?? 'System'} · {formatDateTime(a.created_at)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
