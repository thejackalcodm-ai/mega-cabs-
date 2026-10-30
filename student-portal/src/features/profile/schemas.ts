import { z } from 'zod'
import { name } from '@/features/auth/schemas'
import { COUNTRIES, ENGLISH_TESTS, GENDERS, STUDY_DESTINATIONS, STUDY_LEVELS } from '@/lib/constants'

/** Form inputs give strings; '' means "not provided". */
const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)
const optionalText = (max = 200) => z.preprocess(blankToUndefined, z.string().trim().max(max).optional())
const date = (label: string) =>
  z.string({ required_error: `Enter the ${label}` }).regex(/^\d{4}-\d{2}-\d{2}$/, `Enter the ${label}`)
const optionalDate = z.preprocess(
  blankToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date')
    .optional(),
)
const optionalNumber = (min: number, max: number) =>
  z.preprocess(
    (v) => (blankToUndefined(v) === undefined ? undefined : Number(v)),
    z
      .number({ invalid_type_error: 'Enter a number' })
      .min(min, `Must be at least ${min}`)
      .max(max, `Must be at most ${max}`)
      .optional(),
  )
const todayIso = () => new Date().toISOString().slice(0, 10)

export const personalSchema = z.object({
  first_name: name('first name'),
  last_name: name('last name'),
  date_of_birth: date('date of birth').refine((d) => {
    const age = (Date.now() - Date.parse(d)) / (365.25 * 864e5)
    return age >= 14 && age <= 90
  }, 'Check your date of birth'),
  gender: z.enum(GENDERS, { errorMap: () => ({ message: 'Select an option' }) }),
  nationality: z.string().trim().min(2, 'Enter your nationality').max(80),
  national_id: optionalText(40),
})
export type PersonalValues = z.infer<typeof personalSchema>

export const passportSchema = z.object({
  passport_number: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6,20}$/, 'Use 6–20 letters and numbers, without spaces'),
  passport_expiry: date('expiry date').refine(
    (d) => d > todayIso(),
    'Your passport has expired. Renew it before applying.',
  ),
})
export type PassportValues = z.infer<typeof passportSchema>

export const contactSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9 ()-]{6,19}$/, 'Enter a valid phone number, including the country code'),
  whatsapp: z.preprocess(
    blankToUndefined,
    z
      .string()
      .trim()
      .regex(/^\+?[0-9][0-9 ()-]{6,19}$/, 'Enter a valid number')
      .optional(),
  ),
  address_line: z.string().trim().min(3, 'Enter your address').max(200),
  city: z.string().trim().min(2, 'Enter your city').max(80),
  country: z.enum(COUNTRIES, { errorMap: () => ({ message: 'Select your country' }) }),
})
export type ContactValues = z.infer<typeof contactSchema>

export const emergencySchema = z.object({
  emergency_name: z.string().trim().min(2, 'Enter a name').max(120),
  emergency_relationship: z.string().trim().min(2, 'Enter the relationship').max(60),
  emergency_phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9 ()-]{6,19}$/, 'Enter a valid phone number'),
  emergency_email: z.preprocess(blankToUndefined, z.string().trim().email('Enter a valid email').optional()),
})
export type EmergencyValues = z.infer<typeof emergencySchema>

export const educationSchema = z
  .object({
    id: z.string().optional(),
    institution: z.string().trim().min(2, 'Enter the institution').max(160),
    qualification: z.string().trim().min(2, 'Enter the qualification').max(120),
    field_of_study: optionalText(120),
    start_date: optionalDate,
    end_date: optionalDate,
    grade: optionalText(60),
    graduation_year: optionalNumber(1950, 2100),
  })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, {
    path: ['end_date'],
    message: 'End date must be after the start date',
  })
export type EducationValues = z.infer<typeof educationSchema>

const band = optionalNumber(0, 120)
export const englishSchema = z
  .object({
    id: z.string().optional(),
    test_type: z.enum(['ielts', 'pte', 'toefl', 'other'], { errorMap: () => ({ message: 'Select a test' }) }),
    test_name: optionalText(80),
    overall: z.preprocess(
      (v) => (blankToUndefined(v) === undefined ? undefined : Number(v)),
      z.number({ required_error: 'Enter the overall score', invalid_type_error: 'Enter a number' }),
    ),
    listening: band,
    reading: band,
    writing: band,
    speaking: band,
    test_date: date('test date').refine((d) => d <= todayIso(), 'The test date cannot be in the future'),
  })
  .superRefine((v, ctx) => {
    const test = ENGLISH_TESTS.find((t) => t.value === v.test_type)!
    if (v.test_type === 'other' && !v.test_name)
      ctx.addIssue({ code: 'custom', path: ['test_name'], message: 'Enter the test name' })
    const sectionMax = 'sectionMax' in test ? test.sectionMax : test.max
    const check = (key: 'overall' | 'listening' | 'reading' | 'writing' | 'speaking', max: number) => {
      const value = v[key]
      if (value === undefined) return
      if (value < test.min || value > max)
        ctx.addIssue({ code: 'custom', path: [key], message: `${test.label} scores are ${test.min}–${max}` })
      else if (test.value === 'ielts' && (value * 2) % 1 !== 0)
        ctx.addIssue({ code: 'custom', path: [key], message: 'IELTS bands go up in steps of 0.5' })
    }
    check('overall', test.max)
    for (const k of ['listening', 'reading', 'writing', 'speaking'] as const) check(k, sectionMax)
  })
export type EnglishValues = z.infer<typeof englishSchema>

export const workSchema = z
  .object({
    id: z.string().optional(),
    company: z.string().trim().min(2, 'Enter the company').max(160),
    position: z.string().trim().min(2, 'Enter your position').max(120),
    start_date: date('start date'),
    end_date: optionalDate,
    is_current: z.boolean().default(false),
    responsibilities: optionalText(2000),
  })
  .refine((v) => v.is_current || !!v.end_date, {
    path: ['end_date'],
    message: 'Enter an end date, or tick "I work here now"',
  })
  .refine((v) => !v.end_date || v.end_date >= v.start_date, {
    path: ['end_date'],
    message: 'End date must be after the start date',
  })
export type WorkValues = z.infer<typeof workSchema>

export const preferencesSchema = z.object({
  preferred_destinations: z.array(z.enum(STUDY_DESTINATIONS)).min(1, 'Choose at least one destination'),
  preferred_study_level: z.enum(STUDY_LEVELS.map((l) => l.value) as [string, ...string[]], {
    errorMap: () => ({ message: 'Select a study level' }),
  }),
  preferred_intake: z.string().min(1, 'Select an intake'),
  preferred_subjects: z
    .string()
    .trim()
    .min(2, 'Enter at least one subject')
    .transform((s) =>
      s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 8),
    ),
  budget_max: optionalNumber(0, 1_000_000),
})
export type PreferencesInput = z.input<typeof preferencesSchema>
export type PreferencesValues = z.output<typeof preferencesSchema>

export const goalsSchema = z.object({
  application_goals: z
    .string()
    .trim()
    .min(20, 'Tell us a little more (at least 20 characters)')
    .max(2000, 'Keep it under 2,000 characters'),
})
export type GoalsValues = z.infer<typeof goalsSchema>
