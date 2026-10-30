import { describe, expect, it } from 'vitest'
import { registerSchema, resetPasswordSchema } from '@/features/auth/schemas'

const valid = {
  firstName: 'Nimali',
  lastName: "D'Souza-Perera",
  email: '  Nimali@Example.COM ',
  phone: '+94 77 123 4567',
  country: 'Sri Lanka',
  password: 'Secure#Pass1',
  confirmPassword: 'Secure#Pass1',
}

describe('registerSchema', () => {
  it('accepts valid input and normalises email', () => {
    const r = registerSchema.parse(valid)
    expect(r.email).toBe('nimali@example.com')
  })
  it.each([
    ['weak password', { password: 'password', confirmPassword: 'password' }, 'password'],
    ['mismatched confirmation', { confirmPassword: 'Other#Pass1' }, 'confirmPassword'],
    ['bad phone', { phone: 'call me' }, 'phone'],
    ['unknown country', { country: 'Atlantis' }, 'country'],
    ['bad email', { email: 'nope' }, 'email'],
    ['script in name', { firstName: '<script>' }, 'firstName'],
  ])('rejects %s', (_label, patch, field) => {
    const r = registerSchema.safeParse({ ...valid, ...patch })
    expect(r.success).toBe(false)
    expect(r.error?.issues.map((i) => i.path[0])).toContain(field)
  })
})

it('reports a password mismatch even while other fields are invalid', () => {
  const r = registerSchema.safeParse({ firstName: '', password: 'weak', confirmPassword: 'other' })
  expect(r.error?.issues.map((i) => i.path[0])).toContain('confirmPassword')
})

describe('resetPasswordSchema', () => {
  it('requires matching strong passwords', () => {
    expect(
      resetPasswordSchema.safeParse({ password: 'Secure#Pass1', confirmPassword: 'Secure#Pass1' }).success,
    ).toBe(true)
    expect(resetPasswordSchema.safeParse({ password: 'Secure#Pass1', confirmPassword: 'x' }).success).toBe(
      false,
    )
  })
})
