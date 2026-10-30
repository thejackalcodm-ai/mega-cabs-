import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '@/app/providers/auth-context'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/shared/Logo'
import { homePathFor, ROLE_LABEL } from '@/lib/roles'
import { signOut } from '@/services/auth'

export function NotAuthorizedPage() {
  const { user, status } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const from = (location.state as { from?: string } | null)?.from
  const home = homePathFor(user?.primaryRole)

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12 text-center">
      <Logo />
      <div className="max-w-md space-y-3">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-status-warning-soft text-status-warning">
          <ShieldAlert className="size-7" aria-hidden />
        </span>
        <h1 className="font-display text-3xl font-semibold">You don&apos;t have access to this page</h1>
        <p className="text-muted-foreground">
          {user?.primaryRole ? (
            <>
              You&apos;re signed in as <strong className="text-foreground">{user.fullName}</strong> (
              {ROLE_LABEL[user.primaryRole]}).
              {from && (
                <>
                  {' '}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{from}</code> is only available to
                  other roles.
                </>
              )}
            </>
          ) : (
            'This page is only available to other roles.'
          )}{' '}
          If you think this is a mistake, contact your administrator.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {status === 'signed_in' && user ? (
          <>
            <Button asChild>
              <Link to={home}>Go to my dashboard</Link>
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                await signOut().catch(() => undefined)
                navigate('/login', { replace: true })
              }}
            >
              Switch account
            </Button>
          </>
        ) : (
          <Button asChild>
            <Link to="/login">Sign in</Link>
          </Button>
        )}
      </div>
    </div>
  )
}
