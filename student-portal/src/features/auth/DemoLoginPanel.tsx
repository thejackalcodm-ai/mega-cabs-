import { useState } from 'react'
import { BookOpen, Crown, GraduationCap, Loader2, ShieldCheck, Users } from 'lucide-react'
import { toFriendlyMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { signIn } from '@/services/auth'

/**
 * DEVELOPMENT ONLY. Loaded only when VITE_ENABLE_DEMO_LOGIN=true; otherwise this module is not
 * part of the build. Accounts are created by `npm run seed`.
 */
const DEMO_PASSWORD = 'Demo#Pass123'
const ACCOUNTS = [
  { role: 'Student', email: 'student@demo.portal', icon: GraduationCap },
  { role: 'Counselor', email: 'counselor@demo.portal', icon: Users },
  { role: 'Instructor', email: 'instructor@demo.portal', icon: BookOpen },
  { role: 'Admin', email: 'admin@demo.portal', icon: ShieldCheck },
  { role: 'Super Admin', email: 'superadmin@demo.portal', icon: Crown },
]

export default function DemoLoginPanel({ onError }: { onError: (message: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null)

  async function login(email: string) {
    setBusy(email)
    try {
      await signIn(email, DEMO_PASSWORD) // <GuestOnly> redirects by role
    } catch (e) {
      onError(`${toFriendlyMessage(e)} (Has \`npm run seed\` been run?)`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section
      aria-labelledby="demo-heading"
      className="mt-8 rounded-lg border border-dashed border-[hsl(var(--brass))]/50 bg-brass-soft/60 p-4"
    >
      <h2 id="demo-heading" className="text-sm font-semibold">
        Demo accounts <span className="font-normal text-muted-foreground">· development only</span>
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Sign in instantly as any role.</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ACCOUNTS.map(({ role, email, icon: Icon }) => (
          <button
            key={email}
            type="button"
            onClick={() => void login(email)}
            disabled={busy !== null}
            className={cn(
              'flex items-center gap-2 rounded-md border bg-card px-2.5 py-2 text-left text-xs font-medium shadow-sm transition-colors hover:border-primary/40 hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
            )}
          >
            {busy === email ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Icon className="size-4 text-primary" aria-hidden />
            )}
            {role}
          </button>
        ))}
      </div>
    </section>
  )
}
