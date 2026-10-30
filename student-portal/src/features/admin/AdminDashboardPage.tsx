import { useQuery } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { useCurrentUser } from '@/app/providers/auth-context'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { CardSkeleton } from '@/components/shared/Skeletons'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDate, greeting } from '@/lib/format'
import { hasAnyRole, ROLE_LABEL } from '@/lib/roles'
import { fetchMyPermissions } from '@/services/account'
import { fetchMyTaughtCourses } from '@/services/courses'
import { fetchRecentStudents, type StudentListItem } from '@/services/students'

/** The counselor column is omitted for counselors (it would always be themselves). */
const studentColumns = (showCounselor: boolean): Column<StudentListItem>[] => [
  {
    id: 'name',
    header: 'Student',
    cell: (s) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{s.name || '—'}</p>
        <p className="truncate text-xs text-muted-foreground">{s.email}</p>
      </div>
    ),
    sortValue: (s) => s.name,
    searchValue: (s) => `${s.name} ${s.email} ${s.studentNumber}`,
  },
  {
    id: 'number',
    header: 'ID',
    cell: (s) => <span className="tabular whitespace-nowrap text-muted-foreground">{s.studentNumber}</span>,
    sortValue: (s) => s.studentNumber,
    hideBelow: 'sm',
  },
  {
    id: 'country',
    header: 'Country',
    cell: (s) => s.country ?? '—',
    sortValue: (s) => s.country,
    searchValue: (s) => s.country ?? '',
    hideBelow: 'md',
  },
  ...(showCounselor
    ? ([
        {
          id: 'counselor',
          header: 'Counselor',
          cell: (s) => s.counselor ?? <span className="text-muted-foreground">Unassigned</span>,
          sortValue: (s) => s.counselor,
          searchValue: (s) => s.counselor ?? '',
          hideBelow: 'lg',
        },
      ] satisfies Column<StudentListItem>[])
    : []),
  {
    id: 'joined',
    header: 'Joined',
    cell: (s) => <span className="whitespace-nowrap">{formatDate(s.createdAt)}</span>,
    sortValue: (s) => s.createdAt,
    hideBelow: 'md',
  },
  {
    id: 'status',
    header: 'Status',
    cell: (s) => (
      <Badge tone={s.isActive ? 'success' : 'neutral'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>
    ),
  },
]

/** Phase 2 staff shell: real, role-scoped data. Metrics and charts arrive in Phase 4. */
export function AdminDashboardPage() {
  const user = useCurrentUser()
  const seesStudents = hasAnyRole(user.roles, ['counselor', 'admin', 'super_admin'])
  const teaches = hasAnyRole(user.roles, ['instructor'])
  const permissions = useQuery({
    queryKey: ['my-permissions', user.roles],
    queryFn: () => fetchMyPermissions(user.roles),
  })
  const students = useQuery({
    queryKey: ['students', 'recent'],
    queryFn: () => fetchRecentStudents(50),
    enabled: seesStudents,
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
            ? 'Students assigned to you are listed below.'
            : user.primaryRole === 'instructor'
              ? 'Your courses and learners at a glance.'
              : 'Platform overview.'
        }
      />
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          {seesStudents && (
            <section aria-labelledby="students-heading" className="space-y-3">
              <h2 id="students-heading" className="text-base font-semibold">
                {user.primaryRole === 'counselor' ? 'My students' : 'Recent students'}
              </h2>
              <DataTable
                caption="Students"
                columns={studentColumns(user.primaryRole !== 'counselor')}
                data={students.data}
                getRowId={(s) => s.id}
                isLoading={students.isPending}
                error={students.error}
                onRetry={() => void students.refetch()}
                searchPlaceholder="Search by name, email, ID or country"
                initialSort={{ columnId: 'joined', direction: 'desc' }}
                empty={{
                  title: user.primaryRole === 'counselor' ? 'No students assigned yet' : 'No students yet',
                  description:
                    user.primaryRole === 'counselor'
                      ? 'An admin assigns students to you.'
                      : 'Students appear here when they register.',
                }}
              />
            </section>
          )}
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
        <div>
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
