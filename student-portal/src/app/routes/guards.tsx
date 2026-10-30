import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/app/providers/auth-context'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/shared/ErrorState'
import { FullPageLoader } from '@/components/shared/FullPageLoader'
import { AccountDisabledPage } from '@/features/system/AccountDisabledPage'
import { hasAnyRole, homePathFor, type AppRole } from '@/lib/roles'
import { signOut } from '@/services/auth'

/** Signed in, email verified, profile loaded and active. */
export function RequireAuth() {
  const auth = useAuth()
  const location = useLocation()
  if (auth.status === 'loading' || auth.userLoading) return <FullPageLoader />
  if (auth.status === 'signed_out')
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (!auth.emailVerified) return <Navigate to="/verify-email" replace />
  if (auth.userError || !auth.user) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <div>
          <ErrorState
            error={auth.userError}
            title="We couldn't load your account"
            onRetry={auth.refetchUser}
          />
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              <LogOut /> Sign out
            </Button>
          </div>
        </div>
      </div>
    )
  }
  if (!auth.user.isActive || !auth.user.primaryRole) return <AccountDisabledPage />
  return <Outlet />
}

/** Renders children only for the given roles; otherwise redirects to the not-authorized page. */
export function RequireRole({ roles, children }: { roles: AppRole[]; children?: React.ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user || !hasAnyRole(user.roles, roles)) {
    return <Navigate to="/unauthorized" replace state={{ from: location.pathname }} />
  }
  return children ? <>{children}</> : <Outlet />
}

/** Pages for signed-out visitors (login, register…). Signed-in users go to their dashboard. */
export function GuestOnly() {
  const auth = useAuth()
  const location = useLocation()
  if (auth.status === 'loading' || auth.userLoading) return <FullPageLoader />
  if (auth.status === 'signed_in' && auth.emailVerified && auth.user) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? homePathFor(auth.user.primaryRole)} replace />
  }
  return <Outlet />
}

export function RootRedirect() {
  const auth = useAuth()
  if (auth.status === 'loading' || auth.userLoading) return <FullPageLoader />
  if (auth.status === 'signed_in' && auth.user)
    return <Navigate to={homePathFor(auth.user.primaryRole)} replace />
  if (auth.status === 'signed_in' && !auth.emailVerified) return <Navigate to="/verify-email" replace />
  return <Navigate to="/login" replace />
}
