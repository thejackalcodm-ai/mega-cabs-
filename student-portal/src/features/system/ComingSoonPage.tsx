import { Link } from 'react-router-dom'
import { Hammer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/PageHeader'

/** Honest placeholder for modules scheduled in a later build phase. Performs no fake actions. */
export function ComingSoonPage({ title, phase, home }: { title: string; phase?: number; home: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-brass-soft text-[hsl(var(--brass))]">
          <Hammer className="size-5" aria-hidden />
        </span>
        <p className="font-semibold">This module is being built</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {title} arrives in build phase {phase ?? 'a later phase'}. Nothing on this page is active yet.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-1">
          <Link to={home}>Back to dashboard</Link>
        </Button>
      </Card>
    </>
  )
}
