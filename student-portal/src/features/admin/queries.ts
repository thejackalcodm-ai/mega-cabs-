import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/shared/toast'
import { documentKeys } from '@/features/documents/queries'
import {
  assignCounselor,
  createUser,
  fetchAdminMetrics,
  fetchCounselorDashboard,
  fetchCounselors,
  fetchStudentDirectory,
  fetchStudentSummary,
  requestDocument,
  reviewDocument,
  setAccountActive,
  updateStudentAccount,
  type NewUserInput,
  type StudentEditValues,
} from '@/services/admin'

export const adminKeys = {
  metrics: ['admin', 'metrics'] as const,
  counselorDashboard: ['admin', 'counselor-dashboard'] as const,
  directory: ['students', 'directory'] as const,
  student: (id: string) => ['students', 'summary', id] as const,
  counselors: ['counselors'] as const,
  tab: (id: string, tab: string) => ['students', 'tab', id, tab] as const,
  documentAudit: (id: string) => ['documents', 'audit', id] as const,
}

export const useAdminMetrics = () => useQuery({ queryKey: adminKeys.metrics, queryFn: fetchAdminMetrics })
export const useCounselorDashboard = () =>
  useQuery({ queryKey: adminKeys.counselorDashboard, queryFn: fetchCounselorDashboard })
export const useStudentDirectory = () =>
  useQuery({ queryKey: adminKeys.directory, queryFn: fetchStudentDirectory })
export const useStudentSummary = (id: string) =>
  useQuery({ queryKey: adminKeys.student(id), queryFn: () => fetchStudentSummary(id) })
export const useCounselors = (enabled = true) =>
  useQuery({ queryKey: adminKeys.counselors, queryFn: fetchCounselors, enabled, staleTime: 5 * 60_000 })

/** Anything that changes a student refreshes the directory, the student and the dashboards. */
function useInvalidateStudent() {
  const qc = useQueryClient()
  return (studentId?: string) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['students'] }),
      qc.invalidateQueries({ queryKey: ['admin'] }),
      qc.invalidateQueries({ queryKey: adminKeys.counselors }),
      studentId ? qc.invalidateQueries({ queryKey: adminKeys.student(studentId) }) : undefined,
    ])
}

export function useAssignCounselor() {
  const invalidate = useInvalidateStudent()
  return useMutation({
    mutationFn: ({ studentId, staffId }: { studentId: string; staffId: string | null }) =>
      assignCounselor(studentId, staffId),
    onSuccess: async (_d, v) => {
      await invalidate(v.studentId)
      toast.success(v.staffId ? 'Counselor assigned' : 'Counselor removed')
    },
    onError: (e) => toast.error(e, "Couldn't assign the counselor"),
  })
}

export function useSetAccountActive() {
  const invalidate = useInvalidateStudent()
  return useMutation({
    mutationFn: ({ profileId, active }: { profileId: string; active: boolean; studentId: string }) =>
      setAccountActive(profileId, active),
    onSuccess: async (_d, v) => {
      await invalidate(v.studentId)
      toast.success(v.active ? 'Account reactivated' : 'Account deactivated')
    },
    onError: (e) => toast.error(e, "Couldn't change the account status"),
  })
}

export function useUpdateStudentAccount() {
  const invalidate = useInvalidateStudent()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      profileId,
      values,
    }: {
      profileId: string
      values: StudentEditValues
      studentId: string
    }) => updateStudentAccount(profileId, values),
    onSuccess: async (_d, v) => {
      await Promise.all([invalidate(v.studentId), qc.invalidateQueries({ queryKey: ['student-profile'] })])
      toast.success('Student updated')
    },
    onError: (e) => toast.error(e, "Couldn't save the changes"),
  })
}

export function useCreateUser() {
  const invalidate = useInvalidateStudent()
  return useMutation({
    mutationFn: (input: NewUserInput) => createUser(input),
    onSuccess: async (r) => {
      await invalidate()
      toast.success('Account created', r.invited ? 'We emailed a link to set a password.' : undefined)
    },
    onError: (e) => toast.error(e, "Couldn't create the account"),
  })
}

export function useReviewDocument(studentId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: reviewDocument,
    onSuccess: async (d) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: documentKeys.list(studentId) }),
        qc.invalidateQueries({ queryKey: documentKeys.checklists(studentId) }),
        qc.invalidateQueries({ queryKey: documentKeys.queue }),
        qc.invalidateQueries({ queryKey: adminKeys.documentAudit(d.id) }),
        qc.invalidateQueries({ queryKey: ['students'] }),
        qc.invalidateQueries({ queryKey: ['admin'] }),
      ])
      toast.success(
        d.status === 'approved'
          ? 'Document approved'
          : d.status === 'rejected'
            ? 'Document rejected'
            : d.status === 'resubmission_required'
              ? 'Resubmission requested'
              : 'Marked as under review',
        d.status === 'under_review' ? undefined : 'The student has been notified.',
      )
    },
    onError: (e) => toast.error(e, "Couldn't save the review"),
  })
}

export function useRequestDocument(studentId: string) {
  return useMutation({
    mutationFn: ({ typeId, message }: { typeId: string; message?: string }) =>
      requestDocument(studentId, typeId, message),
    onSuccess: () => toast.success('Request sent', 'The student has been notified.'),
    onError: (e) => toast.error(e, "Couldn't send the request"),
  })
}
