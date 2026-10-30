import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { Enums } from '@/types/database'

export type DocumentStatus = Enums<'document_status'>

/** Status as the student should see it: an expiry date in the past means expired, whatever the stored status. */
export function effectiveStatus(
  status: DocumentStatus,
  expiryDate: string | null,
  today = new Date(),
): DocumentStatus {
  if (expiryDate && differenceInCalendarDays(parseISO(expiryDate), today) < 0) return 'expired'
  return status
}

/** Mirrors delete_document(): students may delete anything not approved or under review. */
export function canStudentDelete(status: DocumentStatus): boolean {
  return status !== 'approved' && status !== 'under_review'
}

/** Mirrors replace_document(): students cannot replace an approved document. */
export function canStudentReplace(status: DocumentStatus): boolean {
  return status !== 'approved'
}

export function needsAction(status: DocumentStatus): boolean {
  return status === 'rejected' || status === 'resubmission_required' || status === 'expired'
}

export type ExpiryState = { kind: 'none' } | { kind: 'ok' | 'soon' | 'expired'; days: number }

export function expiryState(expiryDate: string | null, today = new Date(), soonDays = 30): ExpiryState {
  if (!expiryDate) return { kind: 'none' }
  const days = differenceInCalendarDays(parseISO(expiryDate), today)
  if (days < 0) return { kind: 'expired', days }
  return { kind: days <= soonDays ? 'soon' : 'ok', days }
}

export type ChecklistState = 'complete' | 'pending' | 'missing' | 'rejected' | 'expired'

/** Counts for the checklist chips. The completion percentage itself comes from the database view. */
export function checklistBreakdown(items: { is_required: boolean | null; item_state: string | null }[]) {
  const required = items.filter((i) => i.is_required)
  const count = (s: ChecklistState) => items.filter((i) => i.item_state === s).length
  return {
    required: required.length,
    completed: required.filter((i) => i.item_state === 'complete').length,
    pending: count('pending'),
    missing: required.filter((i) => i.item_state === 'missing').length,
    rejected: count('rejected'),
    expired: count('expired'),
  }
}

export function documentTitle(doc: {
  custom_type_name: string | null
  type?: { name: string } | undefined
}): string {
  return doc.custom_type_name ?? doc.type?.name ?? 'Document'
}
