/**
 * Converts anything thrown by Supabase (auth, PostgREST, storage, network) into a message that is
 * safe to show to a student. Raw database errors are never shown; details go to the console in dev.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

const AUTH_MESSAGES: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "That email and password don't match. Please try again."],
  [/email not confirmed/i, 'Please verify your email address first. Check your inbox for the link.'],
  [
    /user already registered|already been registered/i,
    'An account with this email already exists. Try signing in.',
  ],
  [/password should be at least|weak password|password is known/i, 'Please choose a stronger password.'],
  [/new password should be different/i, 'Your new password must be different from your current one.'],
  [
    /rate limit|too many requests|security purposes/i,
    'Too many attempts. Please wait a minute and try again.',
  ],
  [
    /token has expired|invalid.*(otp|token)|link is invalid|expired/i,
    'This link has expired or was already used. Request a new one.',
  ],
  [/auth session missing/i, 'Your session has ended. Please sign in again.'],
  [/signups not allowed/i, 'New registrations are currently closed.'],
]

// SQLSTATEs our own database functions raise with human-written messages.
const APP_RAISED = new Set(['P0001', '22023'])

const GENERIC = 'Something went wrong. Please try again.'

type ErrorLike = { message?: string; code?: string; status?: number; name?: string }

export function toFriendlyMessage(error: unknown): string {
  if (error instanceof AppError) return error.message
  if (!error) return GENERIC
  const e = error as ErrorLike
  const message = typeof e.message === 'string' ? e.message : ''

  if (error instanceof TypeError && /fetch|network/i.test(message)) {
    return "We couldn't reach the server. Check your connection and try again."
  }
  for (const [pattern, friendly] of AUTH_MESSAGES) if (pattern.test(message)) return friendly

  switch (e.code) {
    case '42501':
      // Our functions raise 42501 with readable messages; Postgres' own RLS messages are not shown.
      return /row-level security|permission denied/i.test(message) || !message
        ? "You don't have permission to do that."
        : message
    case '23505':
      return 'This already exists.'
    case '23503':
      return 'This item is linked to something that no longer exists.'
    case '23514':
    case '23502':
    case '22P02':
      return 'Some of the information is not valid. Please check the form.'
    case 'PGRST116':
      return "We couldn't find what you were looking for."
  }
  if (e.code && APP_RAISED.has(e.code) && message) return message
  if (e.status === 413 || /exceeded the maximum allowed size/i.test(message)) return 'That file is too large.'
  if (/mime type .* is not supported/i.test(message)) return 'That file type is not allowed.'
  return GENERIC
}

/** Logs full details in development only. */
export function reportError(error: unknown, context?: string) {
  if (import.meta.env.DEV) console.error(`[${context ?? 'error'}]`, error)
}

function raise(error: unknown, context?: string): never {
  reportError(error, context)
  throw new AppError(toFriendlyMessage(error), (error as ErrorLike).code, error)
}

/** Returns data, or throws a friendly AppError. A missing row is treated as "not found". */
export function unwrap<T>(result: { data: T | null; error: unknown }, context?: string): T {
  if (result.error) raise(result.error, context)
  if (result.data === null) raise({ code: 'PGRST116' }, context)
  return result.data
}

/** Like unwrap, but a missing row is a valid null (use with maybeSingle()). */
export function unwrapMaybe<T>(result: { data: T | null; error: unknown }, context?: string): T | null {
  if (result.error) raise(result.error, context)
  return result.data
}

/** For calls with no useful data (head counts, updates without returning). */
export function assertOk(result: { error: unknown }, context?: string): void {
  if (result.error) raise(result.error, context)
}
