import { describe, expect, it } from 'vitest'
import { ADMIN_NAV, navForRoles, STUDENT_NAV } from '@/app/navigation'
import { hasAnyRole, homePathFor, primaryRole } from '@/lib/roles'

describe('roles', () => {
  it('picks the highest ranked role', () => {
    expect(primaryRole(['student'])).toBe('student')
    expect(primaryRole(['counselor', 'admin'])).toBe('admin')
    expect(primaryRole(['instructor', 'counselor'])).toBe('counselor') // equal rank: stable alphabetical
    expect(primaryRole([])).toBeNull()
  })
  it('redirects students to /app and staff to /admin', () => {
    expect(homePathFor('student')).toBe('/app')
    for (const r of ['counselor', 'instructor', 'admin', 'super_admin'] as const)
      expect(homePathFor(r)).toBe('/admin')
    expect(homePathFor(null)).toBe('/unauthorized')
  })
  it('checks role membership', () => {
    expect(hasAnyRole(['student'], ['admin', 'super_admin'])).toBe(false)
    expect(hasAnyRole(['counselor', 'instructor'], ['instructor'])).toBe(true)
  })
})

describe('navigation per role', () => {
  const labels = (roles: Parameters<typeof navForRoles>[1]) =>
    navForRoles(ADMIN_NAV, roles).flatMap((g) => g.items.map((i) => i.label))

  it('counselors see student work but not courses, payments or audit', () => {
    const l = labels(['counselor'])
    expect(l).toEqual(expect.arrayContaining(['Students', 'Applications', 'Documents', 'Messages']))
    expect(l).not.toEqual(expect.arrayContaining(['Courses']))
    expect(l).not.toContain('Payments')
    expect(l).not.toContain('Audit log')
  })
  it('instructors see course management only', () => {
    const l = labels(['instructor'])
    expect(l).toEqual(expect.arrayContaining(['Courses', 'Lessons', 'Assignments', 'Quizzes']))
    expect(l).not.toContain('Students')
  })
  it('admins see everything', () => {
    expect(labels(['admin'])).toEqual(
      expect.arrayContaining(['Students', 'Courses', 'Payments', 'Reports', 'Audit log']),
    )
  })
  it('students get the full student sidebar from the spec, without hidden pages', () => {
    const l = navForRoles(STUDENT_NAV, ['student']).flatMap((g) => g.items.map((i) => i.label))
    expect(l).toEqual([
      'Dashboard',
      'My Profile',
      'My Applications',
      'Documents',
      'Universities',
      'Courses',
      'My Learning',
      'Assignments',
      'Calendar',
      'Payments',
      'Messages',
      'Notifications',
      'Help & Support',
      'Settings',
    ])
  })
})
