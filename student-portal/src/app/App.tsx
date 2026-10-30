import { ArrowRight, CheckCircle2, Clock3, GraduationCap, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Phase 0 placeholder: proves the toolchain and design tokens. Replaced by the router in Phase 2.
export function App() {
  const swatches = [
    'primary',
    'brass',
    'sidebar',
    'status-success',
    'status-warning',
    'status-danger',
    'status-info',
  ]
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:py-20">
      <div className="mb-10 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
          <GraduationCap className="size-5" aria-hidden />
        </span>
        <span className="font-display text-2xl font-semibold">Meridian</span>
      </div>
      <h1 className="font-display text-4xl font-semibold">Your path to study abroad, in one place.</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
        Student portal, learning platform and application management. Foundation build — the full application
        arrives in the following phases.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button size="lg">
          Get started <ArrowRight />
        </Button>
        <Button size="lg" variant="outline">
          Sign in
        </Button>
      </div>

      <Card className="mt-12">
        <CardHeader>
          <CardTitle>Design tokens</CardTitle>
          <CardDescription>Laurel &amp; Brass palette, Fraunces + Inter type pairing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-3">
            {swatches.map((s) => (
              <div key={s} className="text-center text-xs text-muted-foreground">
                <div
                  className="mb-1 size-12 rounded-md shadow-card"
                  style={{ background: `hsl(var(--${s}))` }}
                />
                {s}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="success">
              <CheckCircle2 aria-hidden />
              Approved
            </Badge>
            <Badge tone="warning">
              <Clock3 aria-hidden />
              Under review
            </Badge>
            <Badge tone="danger">
              <XCircle aria-hidden />
              Resubmission required
            </Badge>
            <Badge tone="info">Submitted</Badge>
            <Badge tone="neutral">Draft</Badge>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
