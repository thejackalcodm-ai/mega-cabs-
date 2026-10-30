import { cn } from '@/lib/utils'

export function Logo({
  className,
  inverted,
  compact,
}: {
  className?: string
  inverted?: boolean
  compact?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect
          width="32"
          height="32"
          rx="8"
          className={inverted ? 'fill-[hsl(var(--brass))]' : 'fill-primary'}
        />
        <path
          d="M8 22V10l8 7 8-7v12"
          fill="none"
          stroke="hsl(40 30% 96%)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {!compact && <span className="font-display text-xl font-semibold tracking-tight">Meridian</span>}
    </span>
  )
}
