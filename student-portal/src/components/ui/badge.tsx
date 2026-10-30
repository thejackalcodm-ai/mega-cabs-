import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium [&_svg]:size-3.5',
  {
    variants: {
      tone: {
        success: 'border-status-success/20 bg-status-success-soft text-status-success',
        warning: 'border-status-warning/20 bg-status-warning-soft text-status-warning',
        danger: 'border-status-danger/20 bg-status-danger-soft text-status-danger',
        info: 'border-status-info/20 bg-status-info-soft text-status-info',
        neutral: 'border-status-neutral/20 bg-status-neutral-soft text-status-neutral',
        brand: 'border-primary/15 bg-primary-soft text-primary',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}

// eslint-disable-next-line react-refresh/only-export-components
export { Badge, badgeVariants }
