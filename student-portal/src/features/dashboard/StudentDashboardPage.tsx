import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Bell, CheckCircle2, Sparkles } from 'lucide-react'
import { useCurrentUser } from '@/app/providers/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { CardSkeleton } from '@/components/shared/Skeletons'
import { greeting, timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import { fetchProfileCompletion } from '@/services/account'
import { fetchRecentNotifications } from '@/services/notifications'

/**
 * Phase 2 shell. Every number here comes from the database. The full journey dashboard
 * (applications, documents, deadlines, next steps) is added in Phases 3 and 5.
 */
export function StudentDashboardPage() {
  const user = useCurrentUser()
  const completion = useQuery({
    queryKey: ['profile-completion', user.studentId],
    queryFn: () => fetchProfileCompletion(),
  })
  const notifications = useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: () => fetchRecentNotifications(5),
  })
  const [params] = useSearchParams()
  const onboarding = user.onboarding

  // Brand-new students are guided straight into setup; "Finish later" brings them back here.
  if (onboarding && !onboarding.completed && onboarding.step <= 1 && params.get('setup') !== 'later') {
    return <Navigate to="/app/onboarding" replace />
  }

  return (
    <>
      <PageHeader
        eyebrow="Student portal"
        title={`${greeting()}, ${user.firstName}`}
        description="Here's where your study-abroad journey stands."
      />
      {onboarding && !onboarding.completed && (
        <Card className="mb-5 flex flex-col gap-3 border-primary/30 bg-primary-soft/50 p-5 sm:flex-row sm:items-center">
          <Sparkles className="size-5 shrink-0 text-primary" aria-hidden />
          <div className="flex-1">
            <p className="font-semibold">Finish setting up your profile</p>
            <p className="text-sm text-muted-foreground">
              You&apos;re on step {Math.min(onboarding.step, 6)} of 6. It takes a few minutes and your
              counselor needs it to start.
            </p>
          </div>
          <Button asChild>
            <Link to="/app/onboarding">
              Continue setup <ArrowRight />
            </Link>
          </Button>
        </Card>
      )}
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {completion.isPending ? (
            <CardSkeleton lines={4} />
          ) : completion.isError ? (
            <Card>
              <ErrorState error={completion.error} onRetry={() => void completion.refetch()} compact />
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Profile completion</CardTitle>
                <CardDescription>Universities need these details before you can apply.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-end justify-between">
                  <span className="tabular font-display text-4xl font-semibold">
                    {completion.data.percent}%
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {completion.data.completed} of {completion.data.total} complete
                  </span>
                </div>
                <Progress value={completion.data.percent} aria-label="Profile completion" />
                {completion.data.missing.length > 0 ? (
                  <div>
                    <p className="mb-2 text-sm font-medium">Still missing</p>
                    <ul className="flex flex-wrap gap-1.5">
                      {completion.data.missing.slice(0, 8).map((m) => (
                        <li
                          key={m.key}
                          className="rounded-full border bg-surface px-2.5 py-1 text-xs text-muted-foreground"
                        >
                          {m.label}
                        </li>
                      ))}
                      {completion.data.missing.length > 8 && (
                        <li className="px-1 py-1 text-xs text-muted-foreground">
                          +{completion.data.missing.length - 8} more
                        </li>
                      )}
                    </ul>
                  </div>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-status-success">
                    <CheckCircle2 className="size-4" aria-hidden /> Your profile is complete.
                  </p>
                )}
                <Button asChild variant="outline" size="sm">
                  <Link to="/app/profile">
                    Update my profile <ArrowRight />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Latest updates</CardTitle>
            </CardHeader>
            <CardContent>
              {notifications.isPending ? (
                <div className="space-y-3">
                  <CardSkeleton lines={2} />
                </div>
              ) : notifications.isError ? (
                <ErrorState
                  error={notifications.error}
                  onRetry={() => void notifications.refetch()}
                  compact
                />
              ) : notifications.data.length === 0 ? (
                <EmptyState
                  compact
                  icon={Bell}
                  title="No updates yet"
                  description="Document reviews, offers and messages will appear here."
                />
              ) : (
                <ul className="divide-y">
                  {notifications.data.map((n) => (
                    <li key={n.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                      <span
                        className={cn(
                          'mt-1.5 size-2 shrink-0 rounded-full',
                          n.is_read ? 'bg-transparent' : 'bg-[hsl(var(--brass))]',
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className={cn('text-sm', !n.is_read && 'font-semibold')}>
                          {n.title}
                          {!n.is_read && <span className="sr-only"> (unread)</span>}
                        </p>
                        {n.body && <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
                        <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
