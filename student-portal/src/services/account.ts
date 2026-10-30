import { supabase } from '@/lib/supabase'
import { unwrap, unwrapMaybe } from '@/lib/errors'
import { primaryRole, type AppRole } from '@/lib/roles'

export interface CurrentUser {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  avatarUrl: string | null
  isActive: boolean
  roles: AppRole[]
  primaryRole: AppRole | null
  studentId: string | null
  staffId: string | null
}

/** Loads the signed-in user's profile, roles and student/staff record (all via RLS). */
export async function fetchCurrentUser(userId: string): Promise<CurrentUser> {
  const [profileRes, rolesRes, studentRes, staffRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, first_name, last_name, avatar_url, is_active')
      .eq('id', userId)
      .single(),
    supabase.from('user_roles').select('role').eq('user_id', userId),
    supabase.from('students').select('id').eq('profile_id', userId).maybeSingle(),
    supabase.from('staff').select('id').eq('profile_id', userId).maybeSingle(),
  ])
  const profile = unwrap(profileRes, 'account.profile')
  const roles = unwrap(rolesRes, 'account.roles').map((r) => r.role)
  const student = unwrapMaybe(studentRes, 'account.student')
  const staff = unwrapMaybe(staffRes, 'account.staff')
  const fullName = `${profile.first_name} ${profile.last_name}`.trim() || profile.email
  return {
    id: profile.id,
    email: profile.email,
    firstName: profile.first_name || fullName.split(' ')[0],
    lastName: profile.last_name,
    fullName,
    avatarUrl: profile.avatar_url,
    isActive: profile.is_active,
    roles,
    primaryRole: primaryRole(roles),
    studentId: student?.id ?? null,
    staffId: staff?.id ?? null,
  }
}

export async function fetchMyPermissions(roles: AppRole[]): Promise<string[]> {
  if (roles.length === 0) return []
  const rows = unwrap(
    await supabase.from('role_permissions').select('permission').in('role', roles),
    'account.permissions',
  )
  return [...new Set(rows.map((r) => r.permission))].sort()
}

export interface ProfileCompletion {
  percent: number
  completed: number
  total: number
  missing: { key: string; label: string; section: string }[]
}

export async function fetchProfileCompletion(studentId?: string): Promise<ProfileCompletion> {
  const data = unwrap(
    await supabase.rpc('profile_completion', studentId ? { p_student_id: studentId } : {}),
    'account.completion',
  )
  return data as unknown as ProfileCompletion
}
