import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCurrentUser } from '@/services/account'
import { getSession, onAuthChange } from '@/services/auth'
import { AuthContext, currentUserKey, type AuthState } from '@/app/providers/auth-context'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    let active = true
    getSession()
      .then((s) => active && setSession((prev) => (prev === undefined ? s : prev)))
      .catch(() => active && setSession(null))
    const unsubscribe = onAuthChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') {
        setRecovery(false)
        queryClient.clear() // never leak one user's cached data to the next
      }
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [queryClient])

  const userId = session?.user.id
  const userQuery = useQuery({
    queryKey: currentUserKey(userId),
    queryFn: () => fetchCurrentUser(userId!),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  })

  const value = useMemo<AuthState>(
    () => ({
      status: session === undefined ? 'loading' : session ? 'signed_in' : 'signed_out',
      session: session ?? null,
      user: userQuery.data,
      userLoading: !!userId && userQuery.isPending,
      userError: userQuery.error,
      emailVerified: !!session?.user.email_confirmed_at,
      recovery,
      refetchUser: () => void userQuery.refetch(),
    }),
    [session, userId, userQuery, recovery],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
