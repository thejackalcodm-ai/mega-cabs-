import { useEffect, useRef } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/app/providers/auth-context'
import { Button } from '@/components/ui/button'
import { FullPageLoader } from '@/components/shared/FullPageLoader'
import { toast } from '@/components/shared/toast'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { FormAlert } from '@/features/auth/FormAlert'
import { homePathFor } from '@/lib/roles'

/** Landing page for email-verification links. supabase-js exchanges the code in the URL on load. */
export function AuthCallbackPage() {
  const auth = useAuth()
  const announced = useRef(false)
  const params = new URLSearchParams(window.location.search + '&' + window.location.hash.replace(/^#/, ''))
  const linkError = params.get('error_description')

  useEffect(() => {
    if (auth.user && auth.emailVerified && !announced.current) {
      announced.current = true
      toast.success('Email verified', 'Welcome to Meridian.')
    }
  }, [auth.user, auth.emailVerified])

  if (linkError) {
    return (
      <AuthLayout title="We couldn't verify your email">
        <div className="space-y-4">
          <FormAlert>
            This link has expired or was already used. Sign in, or request a new verification email.
          </FormAlert>
          <Button asChild className="w-full" size="lg">
            <Link to="/login">Go to sign in</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/verify-email">Resend verification email</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }
  if (auth.status === 'loading' || auth.userLoading) return <FullPageLoader label="Verifying" />
  if (auth.status === 'signed_in' && auth.user)
    return <Navigate to={homePathFor(auth.user.primaryRole)} replace />
  return <Navigate to="/login" replace />
}
