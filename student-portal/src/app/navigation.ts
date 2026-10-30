import {
  BarChart3,
  Bell,
  BookOpen,
  BookOpenCheck,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileCheck2,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  MessagesSquare,
  PlaySquare,
  ScrollText,
  Settings,
  Send,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { ADMIN_ROLES, STAFF_ROLES, type AppRole } from '@/lib/roles'

export interface NavItem {
  label: string
  /** Path relative to the portal base (no leading slash; '' = index). */
  path: string
  icon: LucideIcon
  /** Roles that may open this page (defaults to every role of the portal). */
  roles?: AppRole[]
  /** Build phase in which the page is implemented; shown as "coming soon" until then. */
  phase?: number
  /** Header-only pages that are not listed in the sidebar. */
  hidden?: boolean
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

export const STUDENT_NAV: NavGroup[] = [
  {
    items: [
      { label: 'Dashboard', path: '', icon: LayoutDashboard },
      { label: 'My Profile', path: 'profile', icon: UserRound },
      { label: 'Set up profile', path: 'onboarding', icon: UserRound, hidden: true },
    ],
  },
  {
    label: 'Study abroad',
    items: [
      { label: 'My Applications', path: 'applications', icon: Send, phase: 5 },
      { label: 'Documents', path: 'documents', icon: FileText },
      { label: 'Universities', path: 'universities', icon: Building2, phase: 5 },
    ],
  },
  {
    label: 'Learning',
    items: [
      { label: 'Courses', path: 'courses', icon: BookOpen, phase: 6 },
      { label: 'My Learning', path: 'learning', icon: GraduationCap, phase: 6 },
      { label: 'Assignments', path: 'assignments', icon: ClipboardCheck, phase: 6 },
      { label: 'Calendar', path: 'calendar', icon: CalendarDays, phase: 7 },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Payments', path: 'payments', icon: CreditCard, phase: 7 },
      { label: 'Messages', path: 'messages', icon: MessagesSquare, phase: 7 },
      { label: 'Notifications', path: 'notifications', icon: Bell, phase: 7 },
      { label: 'Help & Support', path: 'support', icon: LifeBuoy, phase: 7 },
      { label: 'Settings', path: 'settings', icon: Settings, phase: 7 },
      { label: 'Search', path: 'search', icon: BookOpenCheck, phase: 8, hidden: true },
    ],
  },
]

/** Mobile bottom bar (the rest is in the menu drawer). */
export const STUDENT_BOTTOM_NAV = ['', 'applications', 'documents', 'learning']

const STUDENT_MANAGERS: AppRole[] = ['counselor', 'admin', 'super_admin']
const COURSE_MANAGERS: AppRole[] = ['instructor', 'admin', 'super_admin']

export const ADMIN_NAV: NavGroup[] = [
  { items: [{ label: 'Dashboard', path: '', icon: LayoutDashboard }] },
  {
    label: 'Students',
    items: [
      { label: 'Students', path: 'students', icon: Users, roles: STUDENT_MANAGERS, phase: 4 },
      { label: 'Applications', path: 'applications', icon: Send, roles: STUDENT_MANAGERS, phase: 5 },
      { label: 'Documents', path: 'documents', icon: FileCheck2, roles: STUDENT_MANAGERS },
      { label: 'Universities', path: 'universities', icon: Building2, roles: ADMIN_ROLES, phase: 5 },
    ],
  },
  {
    label: 'Learning',
    items: [
      { label: 'Courses', path: 'courses', icon: BookOpen, roles: COURSE_MANAGERS, phase: 6 },
      { label: 'Lessons', path: 'lessons', icon: PlaySquare, roles: COURSE_MANAGERS, phase: 6 },
      { label: 'Assignments', path: 'assignments', icon: ClipboardList, roles: COURSE_MANAGERS, phase: 6 },
      { label: 'Quizzes', path: 'quizzes', icon: ListChecks, roles: COURSE_MANAGERS, phase: 6 },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Payments', path: 'payments', icon: CreditCard, roles: ADMIN_ROLES, phase: 7 },
      { label: 'Messages', path: 'messages', icon: MessagesSquare, phase: 7 },
      { label: 'Notifications', path: 'notifications', icon: Bell, phase: 7 },
      { label: 'Support', path: 'support', icon: LifeBuoy, roles: ADMIN_ROLES, phase: 7 },
      { label: 'Reports', path: 'reports', icon: BarChart3, roles: ADMIN_ROLES, phase: 8 },
      { label: 'Audit log', path: 'audit', icon: ScrollText, roles: ADMIN_ROLES, phase: 8 },
      { label: 'Settings', path: 'settings', icon: Settings, phase: 7 },
      { label: 'Search', path: 'search', icon: BookOpenCheck, phase: 8, hidden: true },
    ],
  },
]

export const PORTALS = {
  student: { base: '/app', label: 'Student portal', roles: ['student'] as AppRole[], nav: STUDENT_NAV },
  admin: { base: '/admin', label: 'Staff portal', roles: STAFF_ROLES, nav: ADMIN_NAV },
} as const

/** Groups with items the given roles can open; empty groups are dropped. */
export function navForRoles(groups: NavGroup[], roles: AppRole[]): NavGroup[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => !i.hidden && (!i.roles || i.roles.some((r) => roles.includes(r)))),
    }))
    .filter((g) => g.items.length > 0)
}
