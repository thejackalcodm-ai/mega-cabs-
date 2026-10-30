import type { Enums } from '@/types/database'

export type AppRole = Enums<'app_role'>

// Mirrors public.roles.rank — the highest ranked role is the user's primary role.
export const ROLE_RANK: Record<AppRole, number> = {
  student: 10,
  counselor: 20,
  instructor: 20,
  admin: 40,
  super_admin: 50,
}

export const ROLE_LABEL: Record<AppRole, string> = {
  student: 'Student',
  counselor: 'Counselor',
  instructor: 'Instructor',
  admin: 'Admin',
  super_admin: 'Super Admin',
}

export const STAFF_ROLES: AppRole[] = ['counselor', 'instructor', 'admin', 'super_admin']
export const ADMIN_ROLES: AppRole[] = ['admin', 'super_admin']

export function primaryRole(roles: AppRole[]): AppRole | null {
  if (roles.length === 0) return null
  return [...roles].sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a] || a.localeCompare(b))[0]
}

export function isStaffRole(role: AppRole | null | undefined): boolean {
  return !!role && STAFF_ROLES.includes(role)
}

/** Where a user lands after signing in. */
export function homePathFor(role: AppRole | null | undefined): string {
  if (!role) return '/unauthorized'
  return role === 'student' ? '/app' : '/admin'
}

export function hasAnyRole(userRoles: AppRole[], allowed: AppRole[]): boolean {
  return userRoles.some((r) => allowed.includes(r))
}
