import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function FormAlert({
  tone = 'error',
  children,
  className,
}: {
  tone?: 'error' | 'success'
  children: React.ReactNode
  className?: string
}) {
  const Icon = tone === 'error' ? AlertCircle : CheckCircle2
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex gap-2.5 rounded-md border px-3 py-2.5 text-sm',
        tone === 'error'
          ? 'border-status-danger/25 bg-status-danger-soft text-status-danger'
          : 'border-status-success/25 bg-status-success-soft text-status-success',
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
