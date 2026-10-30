import { useQuery } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { useCurrentUser } from '@/app/providers/auth-context'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/shared/DataTable'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { CardSkeleton } from '@/components/shared/Skeletons'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDate, greeting } from '@/lib/format'
import { hasAnyRole, ROLE_LABEL } from '@/lib/roles'
import { fetchMyPermissions } from '@/services/account'
import { fetchMyTaughtCourses } from '@/services/courses'
import { AdminOverview } from '@/features/admin/dashboard/AdminOverview'
import { CounselorOverview } from '@/features/admin/dashboard/CounselorOverview'

/** Staff home: admin metrics, the counselor workspace or the instructor's courses, by role. */
export function AdminDashboardPage() {
  const user = useCurrentUser()
  const isAdmin = hasAnyRole(user.roles, ['admin', 'super_admin'])
  const isCounselor = !isAdmin && user.roles.includes('counselor')
  const teaches = hasAnyRole(user.roles, ['instructor'])
  const permissions = useQuery({
    queryKey: ['my-permissions', user.roles],
    queryFn: () => fetchMyPermissions(user.roles),
  })
  const courses = useQuery({
    queryKey: ['courses', 'taught', user.id],
    queryFn: () => fetchMyTaughtCourses(user.id),
    enabled: teaches,
  })

  return (
    <>
      <PageHeader
        eyebrow={user.primaryRole ? `${ROLE_LABEL[user.primaryRole]} workspace` : 'Staff portal'}
        title={`${greeting()}, ${user.firstName}`}
        description={
          user.primaryRole === 'counselor'
            ? 'Your assigned students, documents to review and upcoming deadlines.'
            : user.primaryRole === 'instructor'
              ? 'Your courses and learners at a glance.'
              : 'Platform overview, updated live from the database.'
        }
      />
      <div className="space-y-5">
        <div className="space-y-5">
          {isAdmin && <AdminOverview />}
          {isCounselor && <CounselorOverview />}
          {teaches && (
            <section aria-labelledby="courses-heading" className="space-y-3">
              <h2 id="courses-heading" className="text-base font-semibold">
                My courses
              </h2>
              <DataTable
                caption="Courses"
                columns={[
                  {
                    id: 'title',
                    header: 'Course',
                    cell: (c) => <span className="font-medium">{c.title}</span>,
                    sortValue: (c) => c.title,
                    searchValue: (c) => c.title,
                  },
                  {
                    id: 'status',
                    header: 'Status',
                    cell: (c) => <StatusBadge kind="course" status={c.status} />,
                  },
                  {
                    id: 'enrolled',
                    header: 'Enrolled',
                    cell: (c) => <span className="tabular">{c.enrollments[0]?.count ?? 0}</span>,
                    sortValue: (c) => c.enrollments[0]?.count ?? 0,
                  },
                  {
                    id: 'updated',
                    header: 'Updated',
                    cell: (c) => formatDate(c.updated_at),
                    sortValue: (c) => c.updated_at,
                    hideBelow: 'sm',
                  },
                ]}
                data={courses.data}
                getRowId={(c) => c.id}
                isLoading={courses.isPending}
                error={courses.error}
                onRetry={() => void courses.refetch()}
                empty={{ title: 'No courses yet', description: 'Courses you teach will appear here.' }}
              />
            </section>
          )}
        </div>
        <div className="max-w-xl">
          {permissions.isPending ? (
            <CardSkeleton />
          ) : permissions.isError ? (
            <Card>
              <ErrorState error={permissions.error} onRetry={() => void permissions.refetch()} compact />
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="size-4 text-primary" aria-hidden /> Your access
                </CardTitle>
                <CardDescription>{user.roles.map((r) => ROLE_LABEL[r]).join(', ')}</CardDescription>
              </CardHeader>
              <CardContent>
                {user.roles.includes('super_admin') ? (
                  <p className="text-sm text-muted-foreground">
                    Full access to every module, including role management.
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {permissions.data.map((p) => (
                      <li key={p}>
                        <Badge tone="brand" className="font-mono text-[0.7rem]">
                          {p}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
