import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Loader2, MailCheck } from 'lucide-react'
import { useAuth } from '@/app/providers/auth-context'
import { Button } from '@/components/ui/button'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { FormAlert } from '@/features/auth/FormAlert'
import { toFriendlyMessage } from '@/lib/errors'
import { homePathFor } from '@/lib/roles'
import { resendVerification } from '@/services/auth'

const COOLDOWN = 60

export function VerifyEmailPage() {
  const auth = useAuth()
  const [params] = useSearchParams()
  const email = params.get('email') ?? auth.session?.user.email ?? ''
  const [cooldown, setCooldown] = useState(params.get('sent') ? COOLDOWN : 0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  if (auth.status === 'signed_in' && auth.emailVerified && auth.user)
    return <Navigate to={homePathFor(auth.user.primaryRole)} replace />

  async function resend() {
    setBusy(true)
    setMessage(null)
    try {
      await resendVerification(email)
      setMessage({ tone: 'success', text: 'A new verification link is on its way.' })
      setCooldown(COOLDOWN)
    } catch (e) {
      setMessage({ tone: 'error', text: toFriendlyMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Check your inbox"
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <div className="space-y-5">
        <div className="flex gap-4 rounded-lg border bg-card p-4 shadow-card">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
            <MailCheck className="size-5" aria-hidden />
          </span>
          <p className="text-sm text-muted-foreground">
            We sent a verification link to{' '}
            {email ? <strong className="font-medium text-foreground">{email}</strong> : 'your email address'}.
            Open it on this device to activate your account. The link expires in 24 hours.
          </p>
        </div>
        {message && <FormAlert tone={message.tone}>{message.text}</FormAlert>}
        <Button
          variant="outline"
          className="w-full"
          onClick={resend}
          disabled={!email || busy || cooldown > 0}
        >
          {busy && <Loader2 className="animate-spin" />}
          {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend verification email'}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Can&apos;t find it? Check your spam or promotions folder.
        </p>
      </div>
    </AuthLayout>
  )
}
