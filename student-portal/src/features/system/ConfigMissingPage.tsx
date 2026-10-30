import { configErrors } from '@/lib/env'
import { Logo } from '@/components/shared/Logo'

/** Shown instead of the app when the Supabase environment variables are missing. */
export function ConfigMissingPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-4 py-12">
      <Logo />
      <div>
        <h1 className="font-display text-3xl font-semibold">Almost there: connect Supabase</h1>
        <p className="mt-2 text-muted-foreground">
          The app needs these environment variables before it can start:
        </p>
      </div>
      <ul className="space-y-1 rounded-lg border bg-card p-4 font-mono text-sm shadow-card">
        {configErrors.map((v) => (
          <li key={v}>{v}</li>
        ))}
      </ul>
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
        <li>
          Copy <code className="rounded bg-muted px-1">.env.example</code> to{' '}
          <code className="rounded bg-muted px-1">.env</code>.
        </li>
        <li>Paste your Project URL and anon key from Supabase → Project Settings → API.</li>
        <li>Restart the dev server.</li>
      </ol>
    </div>
  )
}
