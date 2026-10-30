import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileText, FolderOpen, ShieldCheck, Upload } from 'lucide-react'
import { useCurrentUser } from '@/app/providers/auth-context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/native-select'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { CardSkeleton, StatGridSkeleton } from '@/components/shared/Skeletons'
import { StatCard } from '@/components/shared/StatCard'
import { ChecklistPanel } from '@/features/documents/ChecklistPanel'
import { DocumentCard } from '@/features/documents/DocumentCard'
import { PreviewDialog } from '@/features/documents/PreviewDialog'
import { useChecklists, useDeleteDocument, useStudentDocuments } from '@/features/documents/queries'
import { ReplaceDocumentDialog } from '@/features/documents/ReplaceDocumentDialog'
import { UploadDocumentDialog } from '@/features/documents/UploadDocumentDialog'
import { DOCUMENT_CATEGORY_LABEL, DOCUMENT_STATUS } from '@/lib/constants'
import { canStudentReplace, documentTitle, effectiveStatus, needsAction } from '@/lib/documents'
import type { StudentDocument } from '@/services/documents'
import type { Enums } from '@/types/database'

type Category = Enums<'document_category'>

export function DocumentsPage() {
  const user = useCurrentUser()
  const studentId = user.studentId!
  const docs = useStudentDocuments(studentId)
  const checklists = useChecklists(studentId)
  const remove = useDeleteDocument(studentId)
  const [params, setParams] = useSearchParams()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [presetType, setPresetType] = useState<string | undefined>()
  const [replacing, setReplacing] = useState<StudentDocument | null>(null)
  const [deleting, setDeleting] = useState<StudentDocument | null>(null)
  const [preview, setPreview] = useState<{ documentId: string; title: string; version?: number } | null>(null)
  const category = (params.get('category') ?? '') as Category | ''
  const status = params.get('status') ?? ''
  const highlight = params.get('doc')

  const list = useMemo(() => docs.data ?? [], [docs.data])
  const filtered = useMemo(
    () =>
      list.filter(
        (d) =>
          (!category || d.category === category) &&
          (!status ||
            (status === 'action'
              ? needsAction(effectiveStatus(d.status, d.expiry_date))
              : effectiveStatus(d.status, d.expiry_date) === status)),
      ),
    [list, category, status],
  )
  const grouped = useMemo(() => {
    const map = new Map<Category, StudentDocument[]>()
    filtered.forEach((d) => map.set(d.category, [...(map.get(d.category) ?? []), d]))
    return (Object.keys(DOCUMENT_CATEGORY_LABEL) as Category[])
      .filter((c) => map.has(c))
      .map((c) => [c, map.get(c)!] as const)
  }, [filtered])

  // Deep links from notifications: /app/documents?doc=<id>
  useEffect(() => {
    if (highlight && docs.data)
      document.getElementById(`doc-${highlight}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlight, docs.data])

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('doc')
    setParams(next, { replace: true })
  }

  /** From a checklist: replace the existing document of that type if there is one, otherwise upload new. */
  function uploadForType(typeId: string) {
    const existing = list.find((d) => d.document_type_id === typeId)
    if (existing && canStudentReplace(existing.status)) return setReplacing(existing)
    setPresetType(typeId)
    setUploadOpen(true)
  }

  const counts = {
    total: list.length,
    approved: list.filter((d) => effectiveStatus(d.status, d.expiry_date) === 'approved').length,
    review: list.filter((d) =>
      ['uploaded', 'under_review'].includes(effectiveStatus(d.status, d.expiry_date)),
    ).length,
    action: list.filter((d) => needsAction(effectiveStatus(d.status, d.expiry_date))).length,
  }

  return (
    <>
      <PageHeader
        title="Documents"
        description="Upload, track and update everything your applications need."
        actions={
          <Button
            onClick={() => {
              setPresetType(undefined)
              setUploadOpen(true)
            }}
          >
            <Upload /> Upload document
          </Button>
        }
      />

      {docs.isPending ? (
        <StatGridSkeleton />
      ) : (
        !docs.isError && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="All documents" value={counts.total} icon={FileText} />
            <StatCard label="Approved" value={counts.approved} />
            <StatCard label="Awaiting review" value={counts.review} />
            <StatCard
              label="Need your action"
              value={counts.action}
              className={counts.action ? 'border-status-danger/30' : undefined}
            />
          </div>
        )
      )}

      <section aria-labelledby="checklists-heading" className="mt-8">
        <h2 id="checklists-heading" className="mb-3 text-lg font-semibold">
          Application checklists
        </h2>
        {checklists.isPending ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <CardSkeleton lines={5} />
            <CardSkeleton lines={5} />
          </div>
        ) : checklists.isError ? (
          <Card>
            <ErrorState compact error={checklists.error} onRetry={() => void checklists.refetch()} />
          </Card>
        ) : checklists.data.length === 0 ? (
          <Card>
            <EmptyState
              compact
              icon={FolderOpen}
              title="No active applications yet"
              description="When you start an application, its document checklist appears here."
            />
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {checklists.data.map((c) => (
              <ChecklistPanel
                key={c.applicationId}
                checklist={c}
                onUpload={uploadForType}
                onOpen={(id) => setParams({ doc: id })}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="my-documents-heading" className="mt-8">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="my-documents-heading" className="text-lg font-semibold">
            My documents
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:w-[26rem]">
            <NativeSelect
              aria-label="Filter by category"
              value={category}
              onChange={(e) => setFilter('category', e.target.value)}
            >
              <option value="">All categories</option>
              {(Object.keys(DOCUMENT_CATEGORY_LABEL) as Category[]).map((c) => (
                <option key={c} value={c}>
                  {DOCUMENT_CATEGORY_LABEL[c]}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              aria-label="Filter by status"
              value={status}
              onChange={(e) => setFilter('status', e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="action">Needs my action</option>
              {Object.entries(DOCUMENT_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        {docs.isPending ? (
          <div className="space-y-3">
            <CardSkeleton lines={3} />
            <CardSkeleton lines={3} />
          </div>
        ) : docs.isError ? (
          <Card>
            <ErrorState error={docs.error} onRetry={() => void docs.refetch()} />
          </Card>
        ) : list.length === 0 ? (
          <Card>
            <EmptyState
              icon={ShieldCheck}
              title="No documents yet"
              description="Start with your passport and latest transcript. Files are stored privately and only shared with your counselor."
              action={
                <Button onClick={() => setUploadOpen(true)}>
                  <Upload /> Upload your first document
                </Button>
              }
            />
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <EmptyState
              compact
              title="No documents match these filters"
              action={
                <Button variant="outline" size="sm" onClick={() => setParams({}, { replace: true })}>
                  Clear filters
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="space-y-6">
            {grouped.map(([cat, items]) => (
              <div key={cat}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {DOCUMENT_CATEGORY_LABEL[cat]}
                </h3>
                <div className="space-y-3">
                  {items.map((d) => (
                    <DocumentCard
                      key={d.id}
                      doc={d}
                      highlighted={d.id === highlight}
                      onPreview={(version) =>
                        setPreview({ documentId: d.id, title: documentTitle(d), version })
                      }
                      onReplace={() => setReplacing(d)}
                      onDelete={() => setDeleting(d)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        studentId={studentId}
        presetTypeId={presetType}
      />
      <ReplaceDocumentDialog doc={replacing} onClose={() => setReplacing(null)} />
      <PreviewDialog target={preview} onClose={() => setPreview(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting ? documentTitle(deleting) : 'document'}?`}
        description="All versions of this file are permanently removed. This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => remove.mutateAsync(deleting!.id)}
      />
    </>
  )
}
