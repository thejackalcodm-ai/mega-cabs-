import { CheckCircle2, Circle, Clock3, Upload, XCircle, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { checklistBreakdown, type ChecklistState } from '@/lib/documents'
import { cn } from '@/lib/utils'
import type { ApplicationChecklist } from '@/services/documents'

const ITEM: Record<ChecklistState, { icon: typeof Circle; label: string; className: string }> = {
  complete: { icon: CheckCircle2, label: 'Approved', className: 'text-status-success' },
  pending: { icon: Clock3, label: 'Awaiting review', className: 'text-status-warning' },
  missing: { icon: Circle, label: 'Missing', className: 'text-muted-foreground' },
  rejected: { icon: XCircle, label: 'Needs a new upload', className: 'text-status-danger' },
  expired: { icon: AlertTriangle, label: 'Expired', className: 'text-status-danger' },
}

export function ChecklistPanel({
  checklist,
  onUpload,
  onOpen,
}: {
  checklist: ApplicationChecklist
  onUpload: (documentTypeId: string) => void
  onOpen: (documentId: string) => void
}) {
  const counts = checklistBreakdown(checklist.items)
  return (
    <Card className="min-w-0">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate">{checklist.university}</CardTitle>
            <p className="truncate text-sm text-muted-foreground">
              {[checklist.program, checklist.intake, checklist.reference].filter(Boolean).join(' · ')}
            </p>
          </div>
          <StatusBadge kind="application" status={checklist.status} />
        </div>
        <div className="flex items-center gap-3">
          <Progress
            value={checklist.completionPercent}
            className="flex-1"
            aria-label={`${checklist.university} checklist ${checklist.completionPercent}% complete`}
          />
          <span className="tabular text-sm font-semibold">{checklist.completionPercent}%</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {counts.completed} of {counts.required} required approved
          {counts.pending > 0 && ` · ${counts.pending} awaiting review`}
          {counts.missing > 0 && ` · ${counts.missing} missing`}
          {counts.rejected > 0 && ` · ${counts.rejected} rejected`}
          {counts.expired > 0 && ` · ${counts.expired} expired`}
        </p>
      </CardHeader>
      <CardContent>
        {checklist.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Your counselor hasn&apos;t set up a checklist for this application yet.
          </p>
        ) : (
          <ul className="divide-y">
            {checklist.items.map((item) => {
              const state = (item.item_state ?? 'missing') as ChecklistState
              const meta = ITEM[state]
              const needsUpload = state === 'missing' || state === 'rejected' || state === 'expired'
              return (
                <li key={item.id} className="flex items-center gap-3 py-2">
                  <meta.icon className={cn('size-4 shrink-0', meta.className)} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {item.document_name}
                      {!item.is_required && <span className="text-muted-foreground"> (optional)</span>}
                    </p>
                    {item.note && <p className="truncate text-xs text-muted-foreground">{item.note}</p>}
                  </div>
                  <span className={cn('hidden text-xs sm:inline', meta.className)}>{meta.label}</span>
                  <span className="sr-only">{meta.label}</span>
                  {needsUpload ? (
                    <Button
                      size="sm"
                      variant={state === 'missing' ? 'outline' : 'default'}
                      onClick={() => item.document_type_id && onUpload(item.document_type_id)}
                    >
                      <Upload /> Upload
                    </Button>
                  ) : (
                    item.document_id && (
                      <Button size="sm" variant="ghost" onClick={() => onOpen(item.document_id!)}>
                        View
                      </Button>
                    )
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
