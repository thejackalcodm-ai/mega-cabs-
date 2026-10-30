import { describe, expect, it } from 'vitest'
import { AppError, toFriendlyMessage, unwrap } from '@/lib/errors'

describe('toFriendlyMessage', () => {
  it('maps auth errors', () => {
    expect(toFriendlyMessage({ message: 'Invalid login credentials' })).toMatch(/don't match/)
    expect(toFriendlyMessage({ message: 'Email not confirmed' })).toMatch(/verify your email/)
    expect(toFriendlyMessage({ message: 'User already registered' })).toMatch(/already exists/)
  })
  it('never exposes raw RLS / database messages', () => {
    const raw = { code: '42501', message: 'new row violates row-level security policy for table "documents"' }
    expect(toFriendlyMessage(raw)).toBe("You don't have permission to do that.")
    expect(
      toFriendlyMessage({
        code: '23514',
        message: 'new row for relation "documents" violates check constraint',
      }),
    ).not.toMatch(/relation/)
    expect(toFriendlyMessage({ code: 'XX000', message: 'internal: could not open file base/1234' })).toBe(
      'Something went wrong. Please try again.',
    )
  })
  it('shows messages written by our own database functions', () => {
    expect(toFriendlyMessage({ code: '22023', message: 'A reason is required' })).toBe('A reason is required')
    expect(toFriendlyMessage({ code: '42501', message: 'Only a super admin can change roles' })).toBe(
      'Only a super admin can change roles',
    )
  })
  it('handles network failures', () => {
    expect(toFriendlyMessage(new TypeError('Failed to fetch'))).toMatch(/reach the server/)
  })
})

describe('unwrap', () => {
  it('returns data or throws AppError', () => {
    expect(unwrap({ data: 1, error: null })).toBe(1)
    expect(() => unwrap({ data: null, error: { code: '42501', message: 'row-level security' } })).toThrow(
      AppError,
    )
    expect(() => unwrap({ data: null, error: null })).toThrow(/couldn't find/)
  })
})
