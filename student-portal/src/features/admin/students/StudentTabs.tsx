import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Eye, FilePlus2, Loader2, MessagesSquare, ScrollText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { NativeSelect } from '@/components/ui/native-select'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { FormField } from '@/components/shared/FormField'
import { CardSkeleton } from '@/components/shared/Skeletons'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { adminKeys, useRequestDocument } from '@/features/admin/queries'
import { PreviewDialog } from '@/features/documents/PreviewDialog'
import { useDocumentTypes, useStudentDocuments } from '@/features/documents/queries'
import { DOCUMENT_CATEGORY_LABEL } from '@/lib/constants'
import { formatDate, formatDateTime, formatMoney, timeAgo } from '@/lib/format'
import { fetchProfileCompletion } from '@/services/account'
import {
  fetchStudentApplications,
  fetchStudentAudit,
  fetchStudentEnrollments,
  fetchStudentPayments,
  fetchStudentThreads,
  type StudentSummary,
} from '@/services/admin'
import { fetchStudentProfile } from '@/services/profile'

function Loading() {
  return <CardSkeleton lines={4} />
}
function Failed({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <Card>
      <ErrorState error={error} onRetry={retry} />
    </Card>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm">{value || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  )
}

// ---------------------------------------------------------------- Profile

export function ProfileTab({ student }: { student: StudentSummary }) {
  const bundle = useQuery({
    queryKey: ['student-profile', student.id],
    queryFn: () => fetchStudentProfile(student.id, student.profileId),
  })
  const completion = useQuery({
    queryKey: ['profile-completion', student.id],
    queryFn: () => fetchProfileCompletion(student.id),
  })
  if (bundle.isPending) return <Loading />
  if (bundle.isError) return <Failed error={bundle.error} retry={() => void bundle.refetch()} />
  const { account, student: s, details: d, education, english, work } = bundle.data
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Personal details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Name" value={`${account.first_name} ${account.last_name}`} />
              <Field label="Email" value={account.email} />
              <Field label="Phone" value={account.phone} />
              <Field label="Date of birth" value={d?.date_of_birth && formatDate(d.date_of_birth)} />
              <Field label="Gender" value={d?.gender} />
              <Field label="Nationality" value={d?.nationality} />
              <Field label="Passport number" value={d?.passport_number} />
              <Field label="Passport expiry" value={d?.passport_expiry && formatDate(d.passport_expiry)} />
              <Field
                label="Address"
                value={[d?.address_line, d?.city, d?.country ?? account.country].filter(Boolean).join(', ')}
              />
              <Field
                label="Emergency contact"
                value={d?.emergency_name && `${d.emergency_name} · ${d.emergency_phone ?? ''}`}
              />
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Study preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Destinations" value={s.preferred_destinations?.join(', ')} />
              <Field label="Level" value={s.preferred_study_level} />
              <Field label="Intake" value={s.preferred_intake} />
              <Field label="Subjects" value={s.preferred_subjects?.join(', ')} />
              <Field label="Budget" value={s.budget_max != null && formatMoney(Number(s.budget_max))} />
            </dl>
            {s.application_goals && <p className="mt-4 whitespace-pre-line text-sm">{s.application_goals}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Education, English and work</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {education.length + english.length + work.length === 0 && (
              <p className="text-muted-foreground">Nothing added yet.</p>
            )}
            {education.map((e) => (
              <p key={e.id}>
                <span className="font-medium">{e.qualification}</span>{' '}
                {e.field_of_study && `in ${e.field_of_study}`} · {e.institution} {e.grade && `· ${e.grade}`}
              </p>
            ))}
            {english.map((t) => (
              <p key={t.id}>
                <span className="font-medium">{t.test_name ?? t.test_type}</span> · overall {t.overall ?? '—'}
                {t.test_date && ` · ${formatDate(t.test_date)}`}
              </p>
            ))}
            {work.map((w) => (
              <p key={w.id}>
                <span className="font-medium">{w.position}</span> at {w.company}
              </p>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-base">Profile completion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {completion.isPending ? (
            <CardSkeleton lines={2} />
          ) : completion.isError ? (
            <ErrorState compact error={completion.error} onRetry={() => void completion.refetch()} />
          ) : (
            <>
              <p className="tabular text-3xl font-semibold">{completion.data.percent}%</p>
              <Progress value={completion.data.percent} aria-label="Profile completion" />
              {completion.data.missing.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {completion.data.missing.map((m) => (
                    <li key={m.key} className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                      {m.label}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------- Applications

export function ApplicationsTab({ studentId }: { studentId: string }) {
  const apps = useQuery({
    queryKey: adminKeys.tab(studentId, 'applications'),
    queryFn: () => fetchStudentApplications(studentId),
  })
  return (
    <DataTable
      caption="Applications"
      data={apps.data}
      getRowId={(a) => a.id}
      isLoading={apps.isPending}
      error={apps.error}
      onRetry={() => void apps.refetch()}
      initialSort={{ columnId: 'updated', direction: 'desc' }}
      empty={{
        title: 'No applications yet',
        description: 'Applications appear here once the student starts one.',
      }}
      columns={[
        {
          id: 'university',
          header: 'University',
          cell: (a) => (
            <div className="min-w-0">
              <p className="truncate font-medium">{a.university?.name ?? '—'}</p>
              <p className="truncate text-xs text-muted-foreground">
                {a.program?.name ?? 'Programme not chosen'}
              </p>
            </div>
          ),
          sortValue: (a) => a.university?.name ?? '',
          searchValue: (a) => `${a.university?.name ?? ''} ${a.program?.name ?? ''} ${a.reference}`,
        },
        {
          id: 'ref',
          header: 'Reference',
          cell: (a) => <span className="tabular">{a.reference}</span>,
          hideBelow: 'md',
        },
        { id: 'intake', header: 'Intake', cell: (a) => a.intake ?? '—', hideBelow: 'sm' },
        { id: 'status', header: 'Status', cell: (a) => <StatusBadge kind="application" status={a.status} /> },
        {
          id: 'updated',
          header: 'Updated',
          cell: (a) => timeAgo(a.updated_at),
          sortValue: (a) => a.updated_at,
          hideBelow: 'sm',
        },
      ]}
    />
  )
}

// ---------------------------------------------------------------- Documents

export function DocumentsTab({ studentId, studentName }: { studentId: string; studentName: string }) {
  const docs = useStudentDocuments(studentId)
  const [preview, setPreview] = useState<{ documentId: string; title: string } | null>(null)
  const [requesting, setRequesting] = useState(false)
  return (
    <>
      <DataTable
        caption="Documents"
        data={docs.data}
        getRowId={(d) => d.id}
        isLoading={docs.isPending}
        error={docs.error}
        onRetry={() => void docs.refetch()}
        initialSort={{ columnId: 'uploaded', direction: 'desc' }}
        empty={{ title: 'No documents yet', description: 'Request a document and the student is notified.' }}
        toolbar={
          <Button variant="outline" onClick={() => setRequesting(true)}>
            <FilePlus2 /> Request a document
          </Button>
        }
        columns={[
          {
            id: 'type',
            header: 'Document',
            cell: (d) => (
              <Link to={`/admin/documents/${d.id}`} className="block min-w-0 hover:underline">
                <p className="truncate font-medium">{d.custom_type_name ?? d.type?.name ?? 'Document'}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {d.file_name} · v{d.version}
                </p>
              </Link>
            ),
            sortValue: (d) => d.type?.name ?? '',
            searchValue: (d) => `${d.type?.name ?? ''} ${d.custom_type_name ?? ''} ${d.file_name}`,
          },
          {
            id: 'category',
            header: 'Category',
            cell: (d) => DOCUMENT_CATEGORY_LABEL[d.category],
            hideBelow: 'md',
          },
          {
            id: 'uploaded',
            header: 'Uploaded',
            cell: (d) => timeAgo(d.uploaded_at),
            sortValue: (d) => d.uploaded_at,
            hideBelow: 'sm',
          },
          { id: 'status', header: 'Status', cell: (d) => <StatusBadge kind="document" status={d.status} /> },
          {
            id: 'actions',
            header: '',
            className: 'text-right',
            cell: (d) => (
              <div className="flex justify-end gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Preview ${d.type?.name ?? 'document'}`}
                  onClick={() =>
                    setPreview({ documentId: d.id, title: `${d.type?.name ?? 'Document'} · ${studentName}` })
                  }
                >
                  <Eye />
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/admin/documents/${d.id}`}>Review</Link>
                </Button>
              </div>
            ),
          },
        ]}
      />
      <PreviewDialog target={preview} onClose={() => setPreview(null)} />
      <RequestDocumentDialog studentId={studentId} open={requesting} onOpenChange={setRequesting} />
    </>
  )
}

function RequestDocumentDialog({
  studentId,
  open,
  onOpenChange,
}: {
  studentId: string
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const types = useDocumentTypes()
  const request = useRequestDocument(studentId)
  const [typeId, setTypeId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string>()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!typeId) return setError('Choose a document type')
    const ok = await request
      .mutateAsync({ typeId, message })
      .then(() => true)
      .catch(() => false)
    if (ok) {
      setTypeId('')
      setMessage('')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !request.isPending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a document</DialogTitle>
          <DialogDescription>The student gets a notification with your message.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <FormField label="Document type" error={error} required>
            <NativeSelect
              value={typeId}
              onChange={(e) => {
                setTypeId(e.target.value)
                setError(undefined)
              }}
              disabled={types.isPending}
            >
              <option value="">{types.isPending ? 'Loading…' : 'Choose…'}</option>
              {types.data
                ?.filter((t) => !t.is_custom)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </NativeSelect>
          </FormField>
          <FormField label="Message" hint="Optional. Explain what you need and by when.">
            <Textarea rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} />
          </FormField>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={request.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={request.isPending}>
              {request.isPending && <Loader2 className="animate-spin" />} Send request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------- Learning

export function LearningTab({ studentId }: { studentId: string }) {
  const rows = useQuery({
    queryKey: adminKeys.tab(studentId, 'learning'),
    queryFn: () => fetchStudentEnrollments(studentId),
  })
  return (
    <DataTable
      caption="Course enrollments"
      data={rows.data}
      getRowId={(e) => e.id}
      isLoading={rows.isPending}
      error={rows.error}
      onRetry={() => void rows.refetch()}
      empty={{ title: 'Not enrolled in any course' }}
      columns={[
        {
          id: 'course',
          header: 'Course',
          cell: (e) => <span className="font-medium">{e.course?.title ?? '—'}</span>,
          sortValue: (e) => e.course?.title ?? '',
        },
        {
          id: 'progress',
          header: 'Progress',
          cell: (e) => (
            <div className="flex items-center gap-2">
              <Progress
                value={Number(e.progress_percent)}
                className="w-24"
                aria-label={`${e.course?.title ?? 'Course'} progress`}
              />
              <span className="tabular text-xs">{Math.round(Number(e.progress_percent))}%</span>
            </div>
          ),
          sortValue: (e) => Number(e.progress_percent),
        },
        {
          id: 'status',
          header: 'Status',
          cell: (e) => (
            <Badge tone={e.status === 'completed' ? 'success' : e.status === 'dropped' ? 'neutral' : 'info'}>
              {e.status}
            </Badge>
          ),
        },
        {
          id: 'last',
          header: 'Last active',
          cell: (e) => (e.last_accessed_at ? timeAgo(e.last_accessed_at) : 'Never'),
          hideBelow: 'sm',
        },
      ]}
    />
  )
}

// ---------------------------------------------------------------- Payments

export function PaymentsTab({ studentId }: { studentId: string }) {
  const q = useQuery({
    queryKey: adminKeys.tab(studentId, 'payments'),
    queryFn: () => fetchStudentPayments(studentId),
  })
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Invoices</h3>
        <DataTable
          caption="Invoices"
          data={q.data?.invoices}
          getRowId={(i) => i.id}
          isLoading={q.isPending}
          error={q.error}
          onRetry={() => void q.refetch()}
          empty={{ title: 'No invoices' }}
          columns={[
            {
              id: 'title',
              header: 'Invoice',
              cell: (i) => (
                <div className="min-w-0">
                  <p className="truncate font-medium">{i.title}</p>
                  <p className="tabular text-xs text-muted-foreground">{i.invoice_number}</p>
                </div>
              ),
            },
            {
              id: 'total',
              header: 'Total',
              cell: (i) => <span className="tabular">{formatMoney(Number(i.total), i.currency)}</span>,
            },
            {
              id: 'paid',
              header: 'Paid',
              cell: (i) => <span className="tabular">{formatMoney(Number(i.amount_paid), i.currency)}</span>,
              hideBelow: 'sm',
            },
            { id: 'due', header: 'Due', cell: (i) => formatDate(i.due_date), hideBelow: 'md' },
            { id: 'status', header: 'Status', cell: (i) => <StatusBadge kind="invoice" status={i.status} /> },
          ]}
        />
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Payments</h3>
        <DataTable
          caption="Payments"
          data={q.data?.payments}
          getRowId={(p) => p.id}
          isLoading={q.isPending}
          error={q.error}
          onRetry={() => void q.refetch()}
          empty={{ title: 'No payments recorded' }}
          columns={[
            {
              id: 'amount',
              header: 'Amount',
              cell: (p) => (
                <span className="tabular font-medium">{formatMoney(Number(p.amount), p.currency)}</span>
              ),
            },
            { id: 'method', header: 'Method', cell: (p) => p.method ?? p.provider, hideBelow: 'sm' },
            {
              id: 'receipt',
              header: 'Receipt',
              cell: (p) => <span className="tabular">{p.receipt_number ?? '—'}</span>,
              hideBelow: 'md',
            },
            { id: 'date', header: 'Date', cell: (p) => formatDate(p.paid_at ?? p.created_at) },
            { id: 'status', header: 'Status', cell: (p) => <StatusBadge kind="payment" status={p.status} /> },
          ]}
        />
      </section>
    </div>
  )
}

// ---------------------------------------------------------------- Messages

export function MessagesTab({ studentId }: { studentId: string }) {
  const q = useQuery({
    queryKey: adminKeys.tab(studentId, 'messages'),
    queryFn: () => fetchStudentThreads(studentId),
  })
  if (q.isPending) return <Loading />
  if (q.isError) return <Failed error={q.error} retry={() => void q.refetch()} />
  if (q.data.length === 0)
    return (
      <Card>
        <EmptyState
          icon={MessagesSquare}
          title="No conversations yet"
          description="The full messaging centre arrives in Phase 7."
        />
      </Card>
    )
  return (
    <Card>
      <ul className="divide-y">
        {q.data.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{t.subject}</p>
              <p className="text-xs capitalize text-muted-foreground">
                {t.category} · {t.messages[0]?.count ?? 0} message(s)
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(t.last_message_at)}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

// ---------------------------------------------------------------- Audit

export function AuditTab({ studentId }: { studentId: string }) {
  const q = useQuery({
    queryKey: adminKeys.tab(studentId, 'audit'),
    queryFn: () => fetchStudentAudit(studentId),
  })
  return (
    <DataTable
      caption="Audit trail"
      data={q.data}
      getRowId={(a) => a.id}
      isLoading={q.isPending}
      error={q.error}
      onRetry={() => void q.refetch()}
      pageSize={25}
      initialSort={{ columnId: 'when', direction: 'desc' }}
      searchPlaceholder="Search action or person"
      empty={{ title: 'No audit entries', description: 'Actions on this student are recorded here.' }}
      columns={[
        {
          id: 'when',
          header: 'When',
          cell: (a) => (
            <span className="tabular whitespace-nowrap text-xs">{formatDateTime(a.created_at)}</span>
          ),
          sortValue: (a) => a.created_at,
        },
        {
          id: 'action',
          header: 'Action',
          cell: (a) => (
            <span className="inline-flex items-center gap-1.5 font-mono text-xs">
              <ScrollText className="size-3.5 text-muted-foreground" aria-hidden /> {a.action}
            </span>
          ),
          searchValue: (a) => a.action,
        },
        {
          id: 'actor',
          header: 'By',
          cell: (a) => a.actorName ?? (a.actor_id ? 'Unknown user' : 'System'),
          searchValue: (a) => a.actorName ?? '',
        },
        {
          id: 'details',
          header: 'Details',
          cell: (a) => {
            const m = a.metadata as Record<string, unknown> | null
            const reason = m && typeof m.reason === 'string' ? m.reason : null
            return (
              <span className="text-xs text-muted-foreground">
                {reason ??
                  (m && Object.keys(m).length
                    ? Object.entries(m)
                        .map(([k, v]) => `${k}: ${String(v)}`)
                        .join(' · ')
                    : '—')}
              </span>
            )
          },
          hideBelow: 'md',
        },
      ]}
    />
  )
}
