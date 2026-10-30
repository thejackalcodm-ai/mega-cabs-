import { Link } from 'react-router-dom'
import { Logo } from '@/components/shared/Logo'

const JOURNEY = [
  'Build your profile',
  'Explore universities',
  'Apply and upload documents',
  'Prepare with IELTS and PTE courses',
  'Get your offer and visa',
]

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col">
        <Logo inverted />
        <div className="my-auto max-w-md">
          <h2 className="font-display text-4xl font-semibold leading-tight">
            Every step of studying abroad, guided.
          </h2>
          <p className="mt-4 text-sidebar-foreground/75">
            One place for your applications, documents, English preparation and conversations with your
            counselor.
          </p>
          <ol className="mt-10 space-y-4">
            {JOURNEY.map((step, i) => (
              <li key={step} className="flex items-center gap-4">
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-[hsl(var(--brass))]/60 text-sm font-semibold text-[hsl(var(--brass))]">
                  {i + 1}
                </span>
                <span className="text-sidebar-foreground/90">{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <p className="text-xs text-sidebar-muted">
          Your documents are stored privately and only shared with your counselor.
        </p>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full border border-white/5"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -right-10 size-96 rounded-full border border-white/5"
        />
      </aside>
      <main className="flex flex-col px-4 py-8 sm:px-8">
        <Link to="/" className="mb-8 self-start lg:hidden">
          <Logo />
        </Link>
        <div className="mx-auto my-auto w-full max-w-md animate-fade-in">
          <h1 className="font-display text-3xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </main>
    </div>
  )
}
