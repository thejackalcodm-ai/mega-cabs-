/**
 * Pure request handler for the admin-create-user Edge Function. No Deno or network APIs: every
 * side effect is injected, so the authorization and validation rules are unit-tested in Node.
 *
 * Rules
 *  - the caller must be signed in (401) and active
 *  - creating a student requires the students.manage permission (admins)
 *  - creating any staff account requires super admin (only super admins assign roles)
 *  - the service role is used ONLY inside createUser/deleteUser (server-side)
 *  - the audit entry is written with the caller's JWT; if that fails the new user is removed
 */
export const ROLES = ['student', 'counselor', 'instructor', 'admin', 'super_admin'] as const
export type Role = (typeof ROLES)[number]

export interface Caller {
  id: string
  active: boolean
  canManageStudents: boolean
  isSuperAdmin: boolean
}

export interface NewUser {
  email: string
  firstName: string
  lastName: string
  phone: string | null
  country: string | null
  role: Role
  sendInvite: boolean
}

export type CreateResult = { id: string } | { error: 'exists' | 'failed'; message?: string }

export interface Deps {
  /** Resolves the caller from their JWT; null when the token is missing or invalid. */
  getCaller(): Promise<Caller | null>
  /** Service-role user creation (role goes into app_metadata, so the signup trigger assigns it). */
  createUser(user: NewUser): Promise<CreateResult>
  /** Sends a "set your password" email. */
  sendInvite(email: string): Promise<void>
  /** Audit entry, written with the caller's JWT (log_admin_user_created). */
  logCreated(userId: string, role: Role): Promise<void>
  /** Rollback when the audit entry can't be written. */
  deleteUser(userId: string): Promise<void>
}

export interface Response {
  status: number
  body: Record<string, unknown>
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const NAME = /^[\p{L}\p{M}' .-]{1,80}$/u
const PHONE = /^\+?[0-9][0-9 ()-]{6,19}$/

export function parseRequest(body: unknown): { ok: true; user: NewUser } | { ok: false; errors: Record<string, string> } {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  const str = (k: string) => (typeof b[k] === 'string' ? (b[k] as string).trim() : '')
  const errors: Record<string, string> = {}
  const email = str('email').toLowerCase()
  if (!EMAIL.test(email) || email.length > 254) errors.email = 'Enter a valid email address'
  const firstName = str('first_name')
  const lastName = str('last_name')
  if (!NAME.test(firstName)) errors.first_name = 'Enter a first name'
  if (!NAME.test(lastName)) errors.last_name = 'Enter a last name'
  const phone = str('phone') || null
  if (phone && !PHONE.test(phone)) errors.phone = 'Enter a valid phone number'
  const country = str('country').slice(0, 80) || null
  const role = (str('role') || 'student') as Role
  if (!ROLES.includes(role)) errors.role = 'Unknown role'
  if (Object.keys(errors).length) return { ok: false, errors }
  return { ok: true, user: { email, firstName, lastName, phone, country, role, sendInvite: b.send_invite !== false } }
}

export async function handleCreateUser(body: unknown, deps: Deps): Promise<Response> {
  const caller = await deps.getCaller()
  if (!caller) return { status: 401, body: { error: 'Sign in again to continue.' } }
  if (!caller.active) return { status: 403, body: { error: 'Your account is inactive.' } }

  const parsed = parseRequest(body)
  if (!parsed.ok) return { status: 400, body: { error: 'Some details are not valid.', fields: parsed.errors } }
  const user = parsed.user

  if (user.role === 'student' ? !caller.canManageStudents : !caller.isSuperAdmin) {
    return {
      status: 403,
      body: { error: user.role === 'student' ? "You don't have permission to create students." : 'Only a super admin can create staff accounts.' },
    }
  }

  const created = await deps.createUser(user)
  if ('error' in created) {
    return created.error === 'exists'
      ? { status: 409, body: { error: 'An account with this email already exists.' } }
      : { status: 500, body: { error: 'The account could not be created. Please try again.' } }
  }

  try {
    await deps.logCreated(created.id, user.role)
  } catch {
    await deps.deleteUser(created.id).catch(() => undefined)
    return { status: 500, body: { error: 'The account could not be created (audit failed). Nothing was saved.' } }
  }

  let invited = false
  if (user.sendInvite) {
    try {
      await deps.sendInvite(user.email)
      invited = true
    } catch {
      invited = false // account exists; staff can resend from the student page
    }
  }
  return { status: 201, body: { user_id: created.id, role: user.role, invited } }
}
