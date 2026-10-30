import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'

export interface StudentListItem {
  id: string
  studentNumber: string
  name: string
  email: string
  country: string | null
  isActive: boolean
  counselor: string | null
  createdAt: string
}

/** Students visible to the caller (RLS: all for admins, assigned ones for counselors). */
export async function fetchRecentStudents(limit = 25): Promise<StudentListItem[]> {
  const rows = unwrap(
    await supabase
      .from('students')
      .select(
        'id, student_number, created_at, profile:profiles!students_profile_id_fkey(first_name, last_name, email, country, is_active), counselor:staff(profile:profiles!staff_profile_id_fkey(first_name, last_name))',
      )
      .order('created_at', { ascending: false })
      .limit(limit),
    'students.recent',
  )
  return rows.map((r) => ({
    id: r.id,
    studentNumber: r.student_number,
    name: `${r.profile?.first_name ?? ''} ${r.profile?.last_name ?? ''}`.trim(),
    email: r.profile?.email ?? '',
    country: r.profile?.country ?? null,
    isActive: r.profile?.is_active ?? false,
    counselor: r.counselor?.profile
      ? `${r.counselor.profile.first_name} ${r.counselor.profile.last_name}`
      : null,
    createdAt: r.created_at,
  }))
}
