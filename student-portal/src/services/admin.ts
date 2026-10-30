import { supabase } from '@/lib/supabase'
import { AppError, assertOk, reportError, unwrap } from '@/lib/errors'
import type { AppRole } from '@/lib/roles'
import type { Enums, Tables } from '@/types/database'

// ---------------------------------------------------------------- dashboards

export interface CurrencyAmount {
  currency: string
  amount: number
}

export interface AdminMetrics {
  scope: 'all' | 'assigned'
  total_students: number
  active_students: number
  new_applications: number
  applications_pending: number
  documents_pending: number
  offers_received: number
  visa_applications: number
  course_enrollments: number
  payments_30d: CurrencyAmount[]
  outstanding: CurrencyAmount[]
  applications_by_status: { status: Enums<'application_status'>; count: number }[]
  students_by_country: { country: string; count: number }[]
  documents_awaiting: { category: Enums<'document_category'>; count: number }[]
  monthly_applications: { month: string; count: number }[]
  revenue_by_month: { month: string; amounts: Record<string, number> }[]
  course_engagement: { course: string; enrollments: number; avg_progress: number; completed: number }[]
}

/** Every number on the admin dashboard comes from this one database aggregate (RLS-scoped). */
export async function fetchAdminMetrics(): Promise<AdminMetrics> {
  return unwrap(await supabase.rpc('admin_dashboard_metrics'), 'admin.metrics') as unknown as AdminMetrics
}

export interface CounselorDashboard {
  assigned_students: number
  pending_documents: {
    id: string
    uploaded_at: string
    status: Enums<'document_status'>
    version: number
    type_name: string
    student_name: string
    student_id: string
  }[]
  pending_documents_total: number
  upcoming_deadlines: {
    id: string
    title: string
    event_type: string
    starts_at: string
    student_name: string
    student_id: string
  }[]
  attention: {
    id: string
    reference: string
    status: Enums<'application_status'>
    updated_at: string
    university: string
    student_name: string
    student_id: string
    documents_action: number
    reason: string
  }[]
  unread_messages: number
}

export async function fetchCounselorDashboard(): Promise<CounselorDashboard> {
  return unwrap(
    await supabase.rpc('counselor_dashboard'),
    'counselor.dashboard',
  ) as unknown as CounselorDashboard
}

// ---------------------------------------------------------------- directory

export type DirectoryRow = Tables<'student_directory'>
export interface StudentSummary {
  id: string
  profileId: string
  studentNumber: string
  firstName: string
  lastName: string
  name: string
  email: string
  phone: string | null
  country: string | null
  nationality: string | null
  isActive: boolean
  lastSeenAt: string | null
  counselorId: string | null
  counselorName: string | null
  journeyStage: Enums<'journey_stage'> | null
  onboardingCompleted: boolean
  createdAt: string
  activeApplications: number
  documentsPending: number
  documentsAction: number
  latestApplicationStatus: Enums<'application_status'> | null
}

function toSummary(r: DirectoryRow): StudentSummary {
  return {
    id: r.id!,
    profileId: r.profile_id!,
    studentNumber: r.student_number ?? '',
    firstName: r.first_name ?? '',
    lastName: r.last_name ?? '',
    name: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(),
    email: r.email ?? '',
    phone: r.phone,
    country: r.country,
    nationality: r.nationality,
    isActive: !!r.is_active,
    lastSeenAt: r.last_seen_at,
    counselorId: r.counselor_id,
    counselorName: r.counselor_name,
    journeyStage: r.journey_stage,
    onboardingCompleted: !!r.onboarding_completed,
    createdAt: r.created_at ?? '',
    activeApplications: r.active_applications ?? 0,
    documentsPending: r.documents_pending ?? 0,
    documentsAction: r.documents_action ?? 0,
    latestApplicationStatus: r.latest_application_status,
  }
}

/** All students the caller may see: every student for admins, assigned ones for counselors (RLS). */
export async function fetchStudentDirectory(): Promise<StudentSummary[]> {
  const rows = unwrap(
    await supabase
      .from('student_directory')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2000),
    'students.directory',
  )
  return rows.map(toSummary)
}

export async function fetchStudentSummary(studentId: string): Promise<StudentSummary | null> {
  const { data, error } = await supabase
    .from('student_directory')
    .select('*')
    .eq('id', studentId)
    .maybeSingle()
  if (error) unwrap({ data, error }, 'students.summary')
  return data ? toSummary(data) : null
}

export interface CounselorOption {
  staffId: string
  name: string
  email: string
  assignedStudents: number
}

export async function fetchCounselors(): Promise<CounselorOption[]> {
  const rows = unwrap(
    await supabase.from('counselor_directory').select('*').order('first_name'),
    'counselors.list',
  )
  return rows.map((r) => ({
    staffId: r.staff_id!,
    name: `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim(),
    email: r.email ?? '',
    assignedStudents: r.assigned_students ?? 0,
  }))
}

// ---------------------------------------------------------------- student management

export async function assignCounselor(studentId: string, staffId: string | null) {
  assertOk(
    // the generated type marks the argument as required; null unassigns
    await supabase.rpc('assign_counselor', { p_student_id: studentId, p_staff_id: staffId as string }),
    'students.assign',
  )
}

/** Deactivation is enforced in the database (guard_profile_update) and audited by trigger. */
export async function setAccountActive(profileId: string, active: boolean) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ is_active: active })
    .eq('id', profileId)
    .select('id')
  if (error) unwrap({ data, error }, 'students.active')
  if (!data?.length) throw new AppError("You don't have permission to change this account.")
}

export interface StudentEditValues {
  firstName: string
  lastName: string
  phone: string
  country: string
}

export async function updateStudentAccount(profileId: string, v: StudentEditValues) {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      first_name: v.firstName,
      last_name: v.lastName,
      phone: v.phone || null,
      country: v.country || null,
    })
    .eq('id', profileId)
    .select('id')
  if (error) unwrap({ data, error }, 'students.edit')
  if (!data?.length) throw new AppError("You don't have permission to edit this student.")
}

export interface NewUserInput {
  email: string
  firstName: string
  lastName: string
  phone?: string
  country?: string
  role: AppRole
  sendInvite: boolean
}

export interface CreatedUser {
  user_id: string
  role: AppRole
  invited: boolean
}

/**
 * Accounts are created by the admin-create-user Edge Function: creating an auth user needs the
 * secret key, which never reaches the browser. The function re-checks the caller's permission.
 */
export async function createUser(input: NewUserInput): Promise<CreatedUser> {
  const { data, error } = await supabase.functions.invoke<CreatedUser>('admin-create-user', {
    body: {
      email: input.email,
      first_name: input.firstName,
      last_name: input.lastName,
      phone: input.phone || undefined,
      country: input.country || undefined,
      role: input.role,
      send_invite: input.sendInvite,
    },
  })
  if (error) {
    // FunctionsHttpError carries the response; surface the function's own message when it has one
    const ctx = (error as { context?: Response }).context
    let message: string | undefined
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = (await ctx.clone().json()) as { error?: string }
        message = body.error
      } catch {
        /* not JSON */
      }
    }
    reportError(error, 'users.create')
    throw new AppError(message ?? "The account couldn't be created. Please try again.")
  }
  if (!data) throw new AppError("The account couldn't be created. Please try again.")
  return data
}

// ---------------------------------------------------------------- student detail tabs

export async function fetchStudentApplications(studentId: string) {
  return unwrap(
    await supabase
      .from('applications')
      .select(
        'id, reference, status, intake, submitted_at, updated_at, created_at, university:universities(name, country), program:programs(name)',
      )
      .eq('student_id', studentId)
      .order('created_at', { ascending: false }),
    'students.applications',
  )
}

export async function fetchStudentEnrollments(studentId: string) {
  return unwrap(
    await supabase
      .from('enrollments')
      .select(
        'id, status, progress_percent, enrolled_at, last_accessed_at, completed_at, course:courses(title)',
      )
      .eq('student_id', studentId)
      .order('enrolled_at', { ascending: false }),
    'students.enrollments',
  )
}

export async function fetchStudentPayments(studentId: string) {
  const [invoices, payments] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_number, title, currency, total, amount_paid, status, due_date, issued_at')
      .eq('student_id', studentId)
      .order('issued_at', { ascending: false }),
    supabase
      .from('payments')
      .select('id, amount, currency, status, method, provider, receipt_number, paid_at, created_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false }),
  ])
  return {
    invoices: unwrap(invoices, 'students.invoices'),
    payments: unwrap(payments, 'students.payments'),
  }
}

export async function fetchStudentThreads(studentId: string) {
  return unwrap(
    await supabase
      .from('message_threads')
      .select('id, subject, category, last_message_at, created_at, messages(count)')
      .eq('student_id', studentId)
      .order('last_message_at', { ascending: false }),
    'students.threads',
  )
}

export type AuditEntry = Tables<'audit_logs'> & { actorName: string | null }

/** Audit trail for one student (RLS: audit.view only). */
export async function fetchStudentAudit(studentId: string, limit = 200): Promise<AuditEntry[]> {
  const rows = unwrap(
    await supabase
      .from('audit_logs')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(limit),
    'students.audit',
  )
  return withActorNames(rows)
}

export async function fetchEntityAudit(entityId: string, limit = 100): Promise<AuditEntry[]> {
  const rows = unwrap(
    await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(limit),
    'documents.audit',
  )
  return withActorNames(rows)
}

async function withActorNames(rows: Tables<'audit_logs'>[]): Promise<AuditEntry[]> {
  const ids = [...new Set(rows.map((r) => r.actor_id).filter((x): x is string => !!x))]
  const names = new Map<string, string>()
  if (ids.length) {
    const people = unwrap(
      await supabase.from('profiles').select('id, first_name, last_name').in('id', ids),
      'audit.actors',
    )
    people.forEach((p) => names.set(p.id, `${p.first_name} ${p.last_name}`.trim()))
  }
  return rows.map((r) => ({ ...r, actorName: r.actor_id ? (names.get(r.actor_id) ?? null) : null }))
}

// ---------------------------------------------------------------- document review

export type ReviewAction = Enums<'review_action'>

/**
 * One call, one transaction: review_document() updates the document, records the review,
 * notifies the student and writes the audit entry. The reason is mandatory for reject and
 * resubmission (checked here for the UI and again in the database).
 */
export async function reviewDocument(input: {
  documentId: string
  action: ReviewAction
  reason?: string
  requiredAction?: string
  comment?: string
}) {
  if ((input.action === 'rejected' || input.action === 'resubmission_required') && !input.reason?.trim()) {
    throw new AppError('Give the student a reason.')
  }
  return unwrap(
    await supabase.rpc('review_document', {
      p_document_id: input.documentId,
      p_action: input.action,
      p_reason: input.reason?.trim() || undefined,
      p_comment: input.comment?.trim() || undefined,
      p_required_action: input.requiredAction?.trim() || undefined,
    }),
    'documents.review',
  )
}

export async function requestDocument(studentId: string, documentTypeId: string, message?: string) {
  assertOk(
    await supabase.rpc('request_document', {
      p_student_id: studentId,
      p_document_type_id: documentTypeId,
      p_message: message?.trim() || undefined,
    }),
    'documents.request',
  )
}

/** One document with its student, for the review workspace. Null when RLS hides it. */
export async function fetchDocumentForReview(documentId: string) {
  const { data, error } = await supabase
    .from('documents')
    .select('student_id')
    .eq('id', documentId)
    .maybeSingle()
  if (error) unwrap({ data, error }, 'documents.review.load')
  return data?.student_id ?? null
}
