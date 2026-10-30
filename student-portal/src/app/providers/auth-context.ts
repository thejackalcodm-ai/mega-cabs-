import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { CurrentUser } from '@/services/account'

export interface AuthState {
  /** 'loading' until the stored session has been read. */
  status: 'loading' | 'signed_out' | 'signed_in'
  session: Session | null
  user: CurrentUser | undefined
  userLoading: boolean
  userError: unknown
  emailVerified: boolean
  /** True after arriving from a password-recovery link. */
  recovery: boolean
  refetchUser: () => void
}

export const currentUserKey = (id: string | undefined) => ['current-user', id] as const

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** The signed-in user. Only use below <RequireAuth>, where it is guaranteed to be loaded. */
export function useCurrentUser(): CurrentUser {
  const { user } = useAuth()
  if (!user) throw new Error('useCurrentUser used outside <RequireAuth>')
  return user
}
