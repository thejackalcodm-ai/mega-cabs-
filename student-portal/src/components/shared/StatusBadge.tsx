import { Badge } from '@/components/ui/badge'
import { STATUS_MAPS, type StatusKind, type StatusMeta } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface StatusBadgeProps<K extends StatusKind> {
  kind: K
  status: keyof (typeof STATUS_MAPS)[K]
  className?: string
}

/** Always text + icon + colour, never colour alone. */
export function StatusBadge<K extends StatusKind>({ kind, status, className }: StatusBadgeProps<K>) {
  const meta = (STATUS_MAPS[kind] as Record<string, StatusMeta>)[status as string]
  if (!meta) return null
  const Icon = meta.icon
  return (
    <Badge tone={meta.tone} className={cn('whitespace-nowrap', className)}>
      <Icon aria-hidden />
      {meta.label}
    </Badge>
  )
}
