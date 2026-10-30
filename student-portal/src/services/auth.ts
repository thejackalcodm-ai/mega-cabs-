import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { AppError, reportError, toFriendlyMessage } from '@/lib/errors'
import { logClientEvent } from '@/services/audit'

function throwFriendly(error: unknown, context: string): never {
  reportError(error, context)
  throw new AppError(toFriendlyMessage(error), (error as { code?: string }).code, error)
}

const redirect = (path: string) => `${window.location.origin}${path}`

export interface RegisterInput {
  firstName: string
  lastName: string
  email: string
  phone: string
  country: string
  password: string
}

/** Returns whether the user must verify their email before a session exists. */
export async function register(input: RegisterInput): Promise<{ needsVerification: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: redirect('/auth/callback'),
      // user_metadata: read by the signup trigger for the profile. A role here is ignored by the database.
      data: {
        first_name: input.firstName,
        last_name: input.lastName,
        phone: input.phone,
        country: input.country,
      },
    },
  })
  if (error) throwFriendly(error, 'auth.register')
  // Supabase returns a user with no identities when the email is already registered (anti-enumeration).
  if (data.user && data.user.identities?.length === 0) {
    throw new AppError('An account with this email already exists. Try signing in.')
  }
  return { needsVerification: !data.session }
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throwFriendly(error, 'auth.signIn')
  void logClientEvent('auth.login')
  return data.session
}

export async function signOut() {
  await logClientEvent('auth.logout')
  const { error } = await supabase.auth.signOut()
  if (error) throwFriendly(error, 'auth.signOut')
}

/** Signs out this browser only, or every device. */
export async function signOutEverywhere() {
  await logClientEvent('auth.logout')
  const { error } = await supabase.auth.signOut({ scope: 'global' })
  if (error) throwFriendly(error, 'auth.signOutEverywhere')
}

export async function resendVerification(email: string) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: redirect('/auth/callback') },
  })
  if (error) throwFriendly(error, 'auth.resend')
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirect('/reset-password'),
  })
  if (error) throwFriendly(error, 'auth.resetRequest')
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throwFriendly(error, 'auth.updatePassword')
  void logClientEvent('auth.password_changed')
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) throwFriendly(error, 'auth.getSession')
  return data.session
}

export function onAuthChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
  const { data } = supabase.auth.onAuthStateChange(callback)
  return () => data.subscription.unsubscribe()
}
