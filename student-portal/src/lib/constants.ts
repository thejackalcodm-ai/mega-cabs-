import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Clock3,
  FileUp,
  Hourglass,
  RefreshCcw,
  Send,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import type { Enums } from '@/types/database'

/**
 * Single source of truth for status presentation. Keys are typed against the database enums,
 * so adding a status in a migration without a label here is a compile error.
 */
export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand'
export interface StatusMeta {
  label: string
  tone: Tone
  icon: LucideIcon
}

export const DOCUMENT_STATUS: Record<Enums<'document_status'>, StatusMeta> = {
  uploaded: { label: 'Uploaded', tone: 'info', icon: FileUp },
  under_review: { label: 'Under review', tone: 'warning', icon: Clock3 },
  approved: { label: 'Approved', tone: 'success', icon: CheckCircle2 },
  rejected: { label: 'Rejected', tone: 'danger', icon: XCircle },
  resubmission_required: { label: 'Resubmission required', tone: 'danger', icon: RefreshCcw },
  expired: { label: 'Expired', tone: 'neutral', icon: AlertTriangle },
}

export const APPLICATION_STATUS: Record<Enums<'application_status'>, StatusMeta> = {
  planning: { label: 'Planning', tone: 'neutral', icon: CircleDashed },
  application_started: { label: 'Application started', tone: 'info', icon: CircleDot },
  documents_required: { label: 'Documents required', tone: 'warning', icon: FileUp },
  submitted: { label: 'Submitted', tone: 'info', icon: Send },
  under_university_review: { label: 'Under university review', tone: 'warning', icon: Hourglass },
  conditional_offer: { label: 'Conditional offer', tone: 'success', icon: CheckCircle2 },
  unconditional_offer: { label: 'Unconditional offer', tone: 'success', icon: CheckCircle2 },
  deposit_required: { label: 'Deposit required', tone: 'warning', icon: Clock3 },
  deposit_paid: { label: 'Deposit paid', tone: 'success', icon: CheckCircle2 },
  cas_pending: { label: 'CAS pending', tone: 'warning', icon: Hourglass },
  cas_issued: { label: 'CAS issued', tone: 'success', icon: CheckCircle2 },
  visa_preparation: { label: 'Visa preparation', tone: 'info', icon: CircleDot },
  visa_submitted: { label: 'Visa submitted', tone: 'info', icon: Send },
  visa_approved: { label: 'Visa approved', tone: 'success', icon: CheckCircle2 },
  visa_refused: { label: 'Visa refused', tone: 'danger', icon: XCircle },
  withdrawn: { label: 'Withdrawn', tone: 'neutral', icon: Ban },
  completed: { label: 'Completed', tone: 'brand', icon: CheckCircle2 },
}

export const PAYMENT_STATUS: Record<Enums<'payment_status'>, StatusMeta> = {
  pending: { label: 'Pending', tone: 'warning', icon: Clock3 },
  paid: { label: 'Paid', tone: 'success', icon: CheckCircle2 },
  failed: { label: 'Failed', tone: 'danger', icon: XCircle },
  refunded: { label: 'Refunded', tone: 'info', icon: RefreshCcw },
  cancelled: { label: 'Cancelled', tone: 'neutral', icon: Ban },
}

export const INVOICE_STATUS: Record<Enums<'invoice_status'>, StatusMeta> = {
  draft: { label: 'Draft', tone: 'neutral', icon: CircleDashed },
  open: { label: 'Due', tone: 'warning', icon: Clock3 },
  paid: { label: 'Paid', tone: 'success', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', tone: 'neutral', icon: Ban },
  refunded: { label: 'Refunded', tone: 'info', icon: RefreshCcw },
}

export const SUBMISSION_STATUS: Record<Enums<'submission_status'>, StatusMeta> = {
  not_started: { label: 'Not started', tone: 'neutral', icon: CircleDashed },
  in_progress: { label: 'In progress', tone: 'info', icon: CircleDot },
  submitted: { label: 'Submitted', tone: 'info', icon: Send },
  under_review: { label: 'Under review', tone: 'warning', icon: Clock3 },
  graded: { label: 'Graded', tone: 'success', icon: CheckCircle2 },
  resubmission_required: { label: 'Resubmission required', tone: 'danger', icon: RefreshCcw },
}

export const COURSE_STATUS: Record<Enums<'course_status'>, StatusMeta> = {
  draft: { label: 'Draft', tone: 'neutral', icon: CircleDashed },
  published: { label: 'Published', tone: 'success', icon: CheckCircle2 },
  archived: { label: 'Archived', tone: 'neutral', icon: Ban },
}

export const TICKET_STATUS: Record<Enums<'ticket_status'>, StatusMeta> = {
  open: { label: 'Open', tone: 'info', icon: CircleDot },
  in_progress: { label: 'In progress', tone: 'warning', icon: Hourglass },
  waiting_for_student: { label: 'Waiting for you', tone: 'warning', icon: Clock3 },
  resolved: { label: 'Resolved', tone: 'success', icon: CheckCircle2 },
  closed: { label: 'Closed', tone: 'neutral', icon: Ban },
}

export const STATUS_MAPS = {
  document: DOCUMENT_STATUS,
  application: APPLICATION_STATUS,
  payment: PAYMENT_STATUS,
  invoice: INVOICE_STATUS,
  submission: SUBMISSION_STATUS,
  course: COURSE_STATUS,
  ticket: TICKET_STATUS,
} as const
export type StatusKind = keyof typeof STATUS_MAPS

export const DOCUMENT_CATEGORY_LABEL: Record<Enums<'document_category'>, string> = {
  identity: 'Identity',
  education: 'Education',
  english_language: 'English language',
  financial: 'Financial',
  employment: 'Employment',
  university: 'University',
  visa: 'Visa',
  other: 'Other',
}

export const COUNTRIES = [
  'Australia',
  'Bangladesh',
  'Bhutan',
  'Brazil',
  'Canada',
  'China',
  'Colombia',
  'Egypt',
  'Ethiopia',
  'France',
  'Germany',
  'Ghana',
  'India',
  'Indonesia',
  'Iran',
  'Ireland',
  'Italy',
  'Japan',
  'Jordan',
  'Kenya',
  'Malaysia',
  'Maldives',
  'Mexico',
  'Morocco',
  'Nepal',
  'Netherlands',
  'New Zealand',
  'Nigeria',
  'Pakistan',
  'Philippines',
  'Qatar',
  'Saudi Arabia',
  'Singapore',
  'South Africa',
  'South Korea',
  'Spain',
  'Sri Lanka',
  'Thailand',
  'Turkey',
  'Uganda',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Vietnam',
  'Zimbabwe',
  'Other',
] as const
