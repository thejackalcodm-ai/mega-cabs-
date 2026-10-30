import type { StudentProfileBundle } from '@/services/profile'

/** Turns undefined (blank optional field) into null so saving clears the column. */
export function nullify<T extends Record<string, unknown>>(
  values: T,
): { [K in keyof T]: Exclude<T[K], undefined> | null } {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v === undefined ? null : v])) as never
}

const s = (v: string | null | undefined) => v ?? ''
const n = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v))

/** Form defaults for each section, from the stored profile. */
export function sectionDefaults(p: StudentProfileBundle) {
  const d = p.details
  return {
    personal: {
      first_name: p.account.first_name,
      last_name: p.account.last_name,
      date_of_birth: s(d?.date_of_birth),
      gender: s(d?.gender) as never,
      nationality: s(d?.nationality),
      national_id: s(d?.national_id),
    },
    passport: { passport_number: s(d?.passport_number), passport_expiry: s(d?.passport_expiry) },
    contact: {
      phone: s(p.account.phone),
      whatsapp: s(d?.whatsapp),
      address_line: s(d?.address_line),
      city: s(d?.city),
      country: (d?.country ?? p.account.country ?? '') as never,
    },
    emergency: {
      emergency_name: s(d?.emergency_name),
      emergency_relationship: s(d?.emergency_relationship),
      emergency_phone: s(d?.emergency_phone),
      emergency_email: s(d?.emergency_email),
    },
    preferences: {
      preferred_destinations: p.student.preferred_destinations as never,
      preferred_study_level: s(p.student.preferred_study_level),
      preferred_intake: s(p.student.preferred_intake),
      preferred_subjects: p.student.preferred_subjects.join(', '),
      budget_max: n(p.student.budget_max),
    },
    goals: { application_goals: s(p.student.application_goals) },
  }
}

export const recordDefaults = {
  education: (r: StudentProfileBundle['education'][number]) => ({
    id: r.id,
    institution: r.institution,
    qualification: r.qualification,
    field_of_study: s(r.field_of_study),
    start_date: s(r.start_date),
    end_date: s(r.end_date),
    grade: s(r.grade),
    graduation_year: n(r.graduation_year),
  }),
  english: (r: StudentProfileBundle['english'][number]) => ({
    id: r.id,
    test_type: r.test_type as 'ielts',
    test_name: s(r.test_name),
    overall: n(r.overall),
    listening: n(r.listening),
    reading: n(r.reading),
    writing: n(r.writing),
    speaking: n(r.speaking),
    test_date: s(r.test_date),
  }),
  work: (r: StudentProfileBundle['work'][number]) => ({
    id: r.id,
    company: r.company,
    position: r.position,
    start_date: s(r.start_date),
    end_date: s(r.end_date),
    is_current: r.is_current,
    responsibilities: s(r.responsibilities),
  }),
}

/** Maps profile_completion() section keys to page anchors. */
export const SECTION_ANCHOR: Record<string, string> = {
  personal: 'personal',
  passport: 'passport',
  contact: 'contact',
  education: 'education',
  english: 'english',
  preferences: 'preferences',
  goals: 'goals',
  emergency: 'emergency',
}
