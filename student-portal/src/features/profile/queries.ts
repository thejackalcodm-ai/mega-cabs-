import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentUser } from '@/app/providers/auth-context'
import { toast } from '@/components/shared/toast'
import { fetchProfileCompletion } from '@/services/account'
import { fetchStudentProfile } from '@/services/profile'

export const profileKeys = {
  bundle: (studentId: string | null) => ['student-profile', studentId] as const,
  completion: (studentId: string | null) => ['profile-completion', studentId] as const,
}

export function useStudentProfile() {
  const user = useCurrentUser()
  return useQuery({
    queryKey: profileKeys.bundle(user.studentId),
    queryFn: () => fetchStudentProfile(user.studentId!, user.id),
    enabled: !!user.studentId,
  })
}

export function useProfileCompletion() {
  const user = useCurrentUser()
  return useQuery({
    queryKey: profileKeys.completion(user.studentId),
    queryFn: () => fetchProfileCompletion(),
  })
}

/** Wraps a save: shows a toast, refreshes the profile and the completion percentage. */
export function useProfileSave<T>(save: (values: T) => Promise<unknown>, successMessage = 'Saved') {
  const user = useCurrentUser()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: save,
    onSuccess: () => {
      toast.success(successMessage)
      void qc.invalidateQueries({ queryKey: profileKeys.bundle(user.studentId) })
      void qc.invalidateQueries({ queryKey: profileKeys.completion(user.studentId) })
      void qc.invalidateQueries({ queryKey: ['current-user'] })
    },
    onError: (e) => toast.error(e, "Couldn't save your changes"),
  })
}
