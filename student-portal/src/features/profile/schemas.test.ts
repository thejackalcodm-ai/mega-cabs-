import { describe, expect, it } from 'vitest'
import {
  educationSchema,
  englishSchema,
  passportSchema,
  preferencesSchema,
  workSchema,
} from '@/features/profile/schemas'
import { upcomingIntakes } from '@/lib/constants'

const errorsOf = (r: { success: boolean; error?: { issues: { path: (string | number)[] }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => i.path[0])

describe('englishSchema', () => {
  const base = {
    test_type: 'ielts',
    overall: '7',
    listening: '7.5',
    reading: '6.5',
    writing: '6',
    speaking: '7',
    test_date: '2026-05-01',
  }
  it('accepts valid IELTS bands', () => {
    expect(englishSchema.safeParse(base).success).toBe(true)
  })
  it('rejects IELTS bands out of range or not in half steps', () => {
    expect(errorsOf(englishSchema.safeParse({ ...base, overall: '9.5' }))).toContain('overall')
    expect(errorsOf(englishSchema.safeParse({ ...base, writing: '6.3' }))).toContain('writing')
  })
  it('uses the scale of the chosen test', () => {
    expect(
      englishSchema.safeParse({
        ...base,
        test_type: 'pte',
        overall: '65',
        listening: '70',
        reading: '60',
        writing: '62',
        speaking: '68',
      }).success,
    ).toBe(true)
    expect(
      errorsOf(englishSchema.safeParse({ ...base, test_type: 'toefl', overall: '100', listening: '31' })),
    ).toContain('listening')
  })
  it('requires a name for "other" tests and rejects future dates', () => {
    expect(errorsOf(englishSchema.safeParse({ ...base, test_type: 'other' }))).toContain('test_name')
    expect(errorsOf(englishSchema.safeParse({ ...base, test_date: '2999-01-01' }))).toContain('test_date')
  })
})

describe('other profile rules', () => {
  it('passport must be alphanumeric and not expired', () => {
    expect(
      passportSchema.safeParse({ passport_number: 'n1234567', passport_expiry: '2031-01-01' }).data
        ?.passport_number,
    ).toBe('N1234567')
    expect(
      errorsOf(passportSchema.safeParse({ passport_number: 'N12 34', passport_expiry: '2031-01-01' })),
    ).toContain('passport_number')
    expect(
      errorsOf(passportSchema.safeParse({ passport_number: 'N1234567', passport_expiry: '2020-01-01' })),
    ).toContain('passport_expiry')
  })
  it('education end date must follow the start date', () => {
    expect(
      errorsOf(
        educationSchema.safeParse({
          institution: 'Uni',
          qualification: 'BSc',
          start_date: '2022-01-01',
          end_date: '2021-01-01',
        }),
      ),
    ).toContain('end_date')
    expect(
      educationSchema.safeParse({ institution: 'Uni', qualification: 'BSc', graduation_year: '' }).data
        ?.graduation_year,
    ).toBeUndefined()
  })
  it('work needs an end date unless current', () => {
    expect(
      errorsOf(
        workSchema.safeParse({
          company: 'Acme',
          position: 'Analyst',
          start_date: '2022-01-01',
          is_current: false,
        }),
      ),
    ).toContain('end_date')
    expect(
      workSchema.safeParse({
        company: 'Acme',
        position: 'Analyst',
        start_date: '2022-01-01',
        is_current: true,
      }).success,
    ).toBe(true)
  })
  it('preferences split subjects into a list', () => {
    const r = preferencesSchema.parse({
      preferred_destinations: ['Canada'],
      preferred_study_level: 'postgraduate',
      preferred_intake: 'September 2027',
      preferred_subjects: 'Data Science, ,Engineering',
      budget_max: '',
    })
    expect(r.preferred_subjects).toEqual(['Data Science', 'Engineering'])
    expect(r.budget_max).toBeUndefined()
  })
  it('upcoming intakes start after today', () => {
    expect(upcomingIntakes(new Date('2026-10-30'), 4)).toEqual([
      'January 2027',
      'February 2027',
      'July 2027',
      'September 2027',
    ])
  })
})
