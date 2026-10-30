import { supabase } from '@/lib/supabase'
import { assertOk, unwrap, unwrapMaybe } from '@/lib/errors'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database'

export type StudentDetails = Tables<'student_profiles'>
export type EducationRecord = Tables<'education_records'>
export type EnglishTest = Tables<'english_tests'>
export type WorkExperience = Tables<'work_experience'>

export interface StudentProfileBundle {
  account: Pick<Tables<'profiles'>, 'id' | 'email' | 'first_name' | 'last_name' | 'phone' | 'country'>
  student: Pick<
    Tables<'students'>,
    | 'id'
    | 'student_number'
    | 'preferred_destinations'
    | 'preferred_study_level'
    | 'preferred_intake'
    | 'preferred_subjects'
    | 'budget_max'
    | 'application_goals'
    | 'onboarding_step'
    | 'onboarding_completed'
  >
  details: StudentDetails | null
  education: EducationRecord[]
  english: EnglishTest[]
  work: WorkExperience[]
}

export async function fetchStudentProfile(
  studentId: string,
  profileId: string,
): Promise<StudentProfileBundle> {
  const [account, student, details, education, english, work] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, first_name, last_name, phone, country')
      .eq('id', profileId)
      .single(),
    supabase
      .from('students')
      .select(
        'id, student_number, preferred_destinations, preferred_study_level, preferred_intake, preferred_subjects, budget_max, application_goals, onboarding_step, onboarding_completed',
      )
      .eq('id', studentId)
      .single(),
    supabase.from('student_profiles').select('*').eq('student_id', studentId).maybeSingle(),
    supabase
      .from('education_records')
      .select('*')
      .eq('student_id', studentId)
      .order('start_date', { ascending: false }),
    supabase
      .from('english_tests')
      .select('*')
      .eq('student_id', studentId)
      .order('test_date', { ascending: false }),
    supabase
      .from('work_experience')
      .select('*')
      .eq('student_id', studentId)
      .order('start_date', { ascending: false }),
  ])
  return {
    account: unwrap(account, 'profile.account'),
    student: unwrap(student, 'profile.student'),
    details: unwrapMaybe(details, 'profile.details'),
    education: unwrap(education, 'profile.education'),
    english: unwrap(english, 'profile.english'),
    work: unwrap(work, 'profile.work'),
  }
}

export async function updateAccount(profileId: string, values: TablesUpdate<'profiles'>) {
  assertOk(await supabase.from('profiles').update(values).eq('id', profileId), 'profile.updateAccount')
}

export async function saveStudentDetails(
  studentId: string,
  values: Omit<TablesInsert<'student_profiles'>, 'student_id'>,
) {
  assertOk(
    await supabase
      .from('student_profiles')
      .upsert({ ...values, student_id: studentId }, { onConflict: 'student_id' }),
    'profile.details',
  )
}

export async function updateStudent(studentId: string, values: TablesUpdate<'students'>) {
  assertOk(await supabase.from('students').update(values).eq('id', studentId), 'profile.student')
}

type ListTable = 'education_records' | 'english_tests' | 'work_experience'

/** Inserts when `id` is absent, otherwise updates that row (RLS limits both to the student's own records). */
export async function saveListRecord<T extends ListTable>(
  table: T,
  studentId: string,
  values: Omit<TablesInsert<T>, 'student_id'> & { id?: string },
) {
  const { id, ...rest } = values as { id?: string } & Record<string, unknown>
  const row = { ...rest, student_id: studentId }
  if (id)
    assertOk(
      await supabase
        .from(table)
        .update(row as never)
        .eq('id', id),
      `profile.${table}`,
    )
  else assertOk(await supabase.from(table).insert(row as never), `profile.${table}`)
}

export async function deleteListRecord(table: ListTable, id: string) {
  assertOk(await supabase.from(table).delete().eq('id', id), `profile.${table}.delete`)
}

export async function saveOnboardingProgress(step: number, completed = false) {
  assertOk(
    await supabase.rpc('save_onboarding_progress', { p_step: step, p_completed: completed }),
    'onboarding.progress',
  )
}
