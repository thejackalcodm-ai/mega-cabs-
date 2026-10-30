/* eslint-disable react-refresh/only-export-components -- route table, not a component module */
import { lazy, Suspense } from 'react'
import { createBrowserRouter, Outlet, type RouteObject } from 'react-router-dom'
import { ADMIN_NAV, PORTALS, STUDENT_BOTTOM_NAV, STUDENT_NAV, type NavGroup } from '@/app/navigation'
import { GuestOnly, RequireAuth, RequireRole, RootRedirect } from '@/app/routes/guards'
import { FullPageLoader } from '@/components/shared/FullPageLoader'
import { ComingSoonPage } from '@/features/system/ComingSoonPage'
import { NotAuthorizedPage } from '@/features/system/NotAuthorizedPage'
import { NotFoundPage } from '@/features/system/NotFoundPage'
import { RouteErrorPage } from '@/features/system/RouteErrorPage'

const named = <T extends Record<string, React.ComponentType>>(loader: () => Promise<T>, name: keyof T) =>
  lazy(() => loader().then((m) => ({ default: m[name] as React.ComponentType })))

const LoginPage = named(() => import('@/features/auth/LoginPage'), 'LoginPage')
const RegisterPage = named(() => import('@/features/auth/RegisterPage'), 'RegisterPage')
const ForgotPasswordPage = named(() => import('@/features/auth/ForgotPasswordPage'), 'ForgotPasswordPage')
const ResetPasswordPage = named(() => import('@/features/auth/ResetPasswordPage'), 'ResetPasswordPage')
const VerifyEmailPage = named(() => import('@/features/auth/VerifyEmailPage'), 'VerifyEmailPage')
const AuthCallbackPage = named(() => import('@/features/auth/AuthCallbackPage'), 'AuthCallbackPage')
const AppShell = lazy(() => import('@/app/layouts/AppShell').then((m) => ({ default: m.AppShell })))
const StudentDashboardPage = named(
  () => import('@/features/dashboard/StudentDashboardPage'),
  'StudentDashboardPage',
)
const AdminDashboardPage = named(() => import('@/features/admin/AdminDashboardPage'), 'AdminDashboardPage')

function Lazy() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Outlet />
    </Suspense>
  )
}

/** Index route + one route per nav item. Items with `roles` get their own guard on top of the portal guard. */
function portalChildren(groups: NavGroup[], base: string, index: React.ReactNode): RouteObject[] {
  const items = groups.flatMap((g) => g.items).filter((i) => i.path !== '')
  return [
    { index: true, element: index },
    ...items.map((item) => {
      const page = <ComingSoonPage title={item.label} phase={item.phase} home={base} />
      return {
        path: item.path,
        element: item.roles ? <RequireRole roles={item.roles}>{page}</RequireRole> : page,
      }
    }),
  ]
}

export const routes: RouteObject[] = [
  {
    element: <Lazy />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/', element: <RootRedirect /> },
      {
        element: <GuestOnly />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
        ],
      },
      { path: '/verify-email', element: <VerifyEmailPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/auth/callback', element: <AuthCallbackPage /> },
      { path: '/unauthorized', element: <NotAuthorizedPage /> },
      {
        element: <RequireAuth />,
        children: [
          {
            path: PORTALS.student.base,
            element: (
              <RequireRole roles={PORTALS.student.roles}>
                <AppShell
                  base={PORTALS.student.base}
                  portalLabel={PORTALS.student.label}
                  nav={STUDENT_NAV}
                  bottomNav={STUDENT_BOTTOM_NAV}
                  variant="student"
                />
              </RequireRole>
            ),
            children: portalChildren(STUDENT_NAV, PORTALS.student.base, <StudentDashboardPage />),
          },
          {
            path: PORTALS.admin.base,
            element: (
              <RequireRole roles={PORTALS.admin.roles}>
                <AppShell
                  base={PORTALS.admin.base}
                  portalLabel={PORTALS.admin.label}
                  nav={ADMIN_NAV}
                  variant="admin"
                />
              </RequireRole>
            ),
            children: portalChildren(ADMIN_NAV, PORTALS.admin.base, <AdminDashboardPage />),
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
