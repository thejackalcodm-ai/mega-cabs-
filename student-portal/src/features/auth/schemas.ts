import { z } from 'zod'
import { COUNTRIES } from '@/lib/constants'

/** Mirrors supabase/config.toml: minimum 8 characters with lower, upper case letters and digits. */
export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (v: string) => v.length >= 8 },
  { id: 'lower', label: 'A lowercase letter', test: (v: string) => /[a-z]/.test(v) },
  { id: 'upper', label: 'An uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { id: 'digit', label: 'A number', test: (v: string) => /\d/.test(v) },
] as const

export const passwordSchema = z
  .string()
  .max(72, 'Passwords can be at most 72 characters')
  .refine(
    (v) => PASSWORD_RULES.every((r) => r.test(v)),
    'Use 8+ characters with upper and lower case letters and a number',
  )

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Enter your email address')
  .email('Enter a valid email address')

/** Person-name rule shared by registration and the profile. */
export const name = (field: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter your ${field}`)
    .max(80, `${field[0].toUpperCase()}${field.slice(1)} is too long`)
    .regex(
      /^[\p{L}\p{M}' .-]+$/u,
      `${field[0].toUpperCase()}${field.slice(1)} can only contain letters, spaces, ' . and -`,
    )

/**
 * Adds the "passwords match" check as an independent branch. A plain .refine() on the object only
 * runs once every other field is valid, which hid the mismatch error behind unrelated errors.
 */
const passwordsMatch = z
  .object({ password: z.string(), confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: "Passwords don't match",
  })

export const registerSchema = z.intersection(
  z.object({
    firstName: name('first name'),
    lastName: name('last name'),
    email,
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9][0-9 ()-]{6,19}$/, 'Enter a valid phone number, including the country code'),
    country: z.enum(COUNTRIES, { errorMap: () => ({ message: 'Select your country' }) }),
    password: passwordSchema,
    confirmPassword: z.string(),
  }),
  passwordsMatch,
)
export type RegisterValues = z.infer<typeof registerSchema>

export const loginSchema = z.object({ email, password: z.string().min(1, 'Enter your password') })
export type LoginValues = z.infer<typeof loginSchema>

export const forgotPasswordSchema = z.object({ email })
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z.intersection(
  z.object({ password: passwordSchema, confirmPassword: z.string() }),
  passwordsMatch,
)
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>
