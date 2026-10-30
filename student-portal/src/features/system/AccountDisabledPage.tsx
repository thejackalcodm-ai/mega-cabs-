import { useNavigate } from 'react-router-dom'
import { UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/shared/Logo'
import { signOut } from '@/services/auth'

export function AccountDisabledPage() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 text-center">
      <Logo />
      <div className="max-w-md space-y-3">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-status-neutral-soft text-status-neutral">
          <UserX className="size-7" aria-hidden />
        </span>
        <h1 className="font-display text-3xl font-semibold">Your account is inactive</h1>
        <p className="text-muted-foreground">
          Your account has been deactivated or has no role assigned yet. Please contact support or your
          counselor to restore access.
        </p>
      </div>
      <Button
        variant="outline"
        onClick={async () => {
          await signOut().catch(() => undefined)
          navigate('/login', { replace: true })
        }}
      >
        Sign out
      </Button>
    </div>
  )
}
