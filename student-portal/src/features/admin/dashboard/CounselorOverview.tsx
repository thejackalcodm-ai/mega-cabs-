import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarClock, FileClock, MessagesSquare, Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { CardSkeleton } from '@/components/shared/Skeletons'
import { StatCard } from '@/components/shared/StatCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useCounselorDashboard } from '@/features/admin/queries'
import { formatDateTime, timeAgo } from '@/lib/format'

/** Counselor workspace from counselor_dashboard(): only students assigned to the signed-in counselor. */
export function CounselorOverview() {
  const dash = useCounselorDashboard()
  if (dash.isPending)
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Loading your workspace">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <CardSkeleton key={i} lines={1} />
          ))}
        </div>
        <CardSkeleton lines={5} />
      </div>
    )
  if (dash.isError)
    return (
      <Card>
        <ErrorState error={dash.error} onRetry={() => void dash.refetch()} />
      </Card>
    )
  const d = dash.data
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Assigned students" value={d.assigned_students} icon={Users} to="/admin/students" />
        <StatCard
          label="Documents to review"
          value={d.pending_documents_total}
          icon={FileClock}
          to="/admin/documents"
        />
        <StatCard label="Need attention" value={d.attention.length} icon={AlertTriangle} />
        <StatCard label="Unread messages" value={d.unread_messages} icon={MessagesSquare} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documents waiting for you</CardTitle>
            <CardDescription>Oldest first</CardDescription>
          </CardHeader>
          <CardContent>
            {d.pending_documents.length === 0 ? (
              <EmptyState
                compact
                icon={FileClock}
                title="Nothing to review"
                description="New uploads from your students appear here."
              />
            ) : (
              <ul className="divide-y">
                {d.pending_documents.map((doc) => (
                  <li key={doc.id}>
                    <Link
                      to={`/admin/documents/${doc.id}`}
                      className="flex items-center justify-between gap-3 py-2.5 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{doc.type_name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {doc.student_name} · v{doc.version} · {timeAgo(doc.uploaded_at)}
                        </p>
                      </div>
                      <StatusBadge kind="document" status={doc.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming deadlines</CardTitle>
            <CardDescription>Next 21 days</CardDescription>
          </CardHeader>
          <CardContent>
            {d.upcoming_deadlines.length === 0 ? (
              <EmptyState compact icon={CalendarClock} title="No deadlines in the next three weeks" />
            ) : (
              <ul className="divide-y">
                {d.upcoming_deadlines.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{e.title}</p>
                      <Link
                        to={`/admin/students/${e.student_id}`}
                        className="truncate text-xs text-muted-foreground hover:underline"
                      >
                        {e.student_name}
                      </Link>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(e.starts_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Students who need attention</CardTitle>
          <CardDescription>Missing documents, offers to discuss, deposits and visas</CardDescription>
        </CardHeader>
        <CardContent>
          {d.attention.length === 0 ? (
            <EmptyState compact icon={AlertTriangle} title="Everyone is on track" />
          ) : (
            <ul className="divide-y">
              {d.attention.map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/admin/students/${a.student_id}`}
                    className="flex flex-col gap-1 py-2.5 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {a.student_name}{' '}
                        <span className="font-normal text-muted-foreground">· {a.university}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.reason}
                        {a.documents_action > 0 && ` · ${a.documents_action} document(s) to re-upload`}
                      </p>
                    </div>
                    <StatusBadge kind="application" status={a.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
