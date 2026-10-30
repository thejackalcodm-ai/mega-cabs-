import { z } from 'zod'
import { name } from '@/features/auth/schemas'
import { COUNTRIES } from '@/lib/constants'

const phone = z
  .string()
  .trim()
  .regex(/^(\+?[0-9][0-9 ()-]{6,19})?$/, 'Enter a valid phone number, including the country code')

const country = z.union([z.enum(COUNTRIES), z.literal('')])

export const newUserSchema = z.object({
  firstName: name('first name'),
  lastName: name('last name'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Enter an email address')
    .email('Enter a valid email address'),
  phone,
  country,
  role: z.enum(['student', 'counselor', 'instructor', 'admin']),
  sendInvite: z.boolean(),
})
export type NewUserValues = z.infer<typeof newUserSchema>

export const editStudentSchema = z.object({
  firstName: name('first name'),
  lastName: name('last name'),
  phone,
  country,
})
export type EditStudentValues = z.infer<typeof editStudentSchema>

const reason = z.string().trim().min(5, 'Give the student a reason (at least 5 characters)').max(500)

export const reviewSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approved'), comment: z.string().trim().max(1000) }),
  z.object({
    action: z.enum(['rejected', 'resubmission_required']),
    reason,
    requiredAction: z.string().trim().max(500),
    comment: z.string().trim().max(1000),
  }),
])
export type ReviewValues = z.infer<typeof reviewSchema>
