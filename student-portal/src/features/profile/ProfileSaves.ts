import type {
  EducationValues,
  EmergencyValues,
  EnglishValues,
  GoalsValues,
  PassportValues,
  PersonalValues,
  PreferencesValues,
  WorkValues,
  ContactValues,
} from '@/features/profile/schemas'
import { nullify } from '@/features/profile/sections'
import { saveListRecord, saveStudentDetails, updateAccount, updateStudent } from '@/services/profile'

/** One save function per section; used by both onboarding and the profile page. */
export const saves = {
  personal: (studentId: string, profileId: string) => async (v: PersonalValues) => {
    await updateAccount(profileId, { first_name: v.first_name, last_name: v.last_name })
    await saveStudentDetails(
      studentId,
      nullify({
        date_of_birth: v.date_of_birth,
        gender: v.gender,
        nationality: v.nationality,
        national_id: v.national_id,
      }),
    )
  },
  passport: (studentId: string) => (v: PassportValues) => saveStudentDetails(studentId, v),
  contact: (studentId: string, profileId: string) => async (v: ContactValues) => {
    await updateAccount(profileId, { phone: v.phone, country: v.country })
    await saveStudentDetails(
      studentId,
      nullify({ whatsapp: v.whatsapp, address_line: v.address_line, city: v.city, country: v.country }),
    )
  },
  emergency: (studentId: string) => (v: EmergencyValues) => saveStudentDetails(studentId, nullify(v)),
  preferences: (studentId: string) => (v: PreferencesValues) =>
    updateStudent(studentId, { ...v, budget_max: v.budget_max ?? null }),
  goals: (studentId: string) => (v: GoalsValues) => updateStudent(studentId, v),
  education: (studentId: string) => (v: EducationValues) =>
    saveListRecord('education_records', studentId, nullify(v) as never),
  english: (studentId: string) => (v: EnglishValues) =>
    saveListRecord('english_tests', studentId, nullify(v) as never),
  work: (studentId: string) => (v: WorkValues) =>
    saveListRecord(
      'work_experience',
      studentId,
      nullify({ ...v, end_date: v.is_current ? undefined : v.end_date }) as never,
    ),
}
