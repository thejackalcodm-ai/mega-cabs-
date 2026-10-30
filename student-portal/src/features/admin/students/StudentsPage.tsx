import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { useCurrentUser } from '@/app/providers/auth-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useStudentDirectory } from '@/features/admin/queries'
import { AddUserDialog } from '@/features/admin/students/StudentDialogs'
import { formatDate, timeAgo } from '@/lib/format'
import { hasAnyRole } from '@/lib/roles'
import type { StudentSummary } from '@/services/admin'

type StatusFilter = '' | 'active' | 'inactive' | 'attention'

/** Directory of students the caller may see (RLS: all for admins, assigned for counselors). */
export function StudentsPage() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const isAdmin = hasAnyRole(user.roles, ['admin', 'super_admin'])
  const directory = useStudentDirectory()
  const [status, setStatus] = useState<StatusFilter>('')
  const [counselor, setCounselor] = useState('')
  const [country, setCountry] = useState('')
  const [adding, setAdding] = useState(false)

  const counselors = useMemo(() => {
    const m = new Map<string, string>()
    directory.data?.forEach((s) => s.counselorId && m.set(s.counselorId, s.counselorName ?? 'Counselor'))
    return [...m].sort((a, b) => a[1].localeCompare(b[1]))
  }, [directory.data])
  const countries = useMemo(
    () => [...new Set((directory.data ?? []).map((s) => s.country).filter((c): c is string => !!c))].sort(),
    [directory.data],
  )
  const rows = useMemo(
    () =>
      (directory.data ?? []).filter(
        (s) =>
          (status === '' ||
            (status === 'active' && s.isActive) ||
            (status === 'inactive' && !s.isActive) ||
            (status === 'attention' && (s.documentsAction > 0 || s.documentsPending > 0))) &&
          (counselor === '' || (counselor === 'none' ? !s.counselorId : s.counselorId === counselor)) &&
          (country === '' || s.country === country),
      ),
    [directory.data, status, counselor, country],
  )

  const columns: Column<StudentSummary>[] = [
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
      searchValue: (s) => `${s.name} ${s.email} ${s.studentNumber} ${s.phone ?? ''}`,
    },
    {
      id: 'number',
      header: 'ID',
      cell: (s) => <span className="tabular whitespace-nowrap text-muted-foreground">{s.studentNumber}</span>,
      sortValue: (s) => s.studentNumber,
      hideBelow: 'lg',
    },
    {
      id: 'country',
      header: 'Country',
      cell: (s) => s.country ?? '—',
      sortValue: (s) => s.country,
      searchValue: (s) => s.country ?? '',
      hideBelow: 'md',
    },
    ...(isAdmin
      ? ([
          {
            id: 'counselor',
            header: 'Counselor',
            cell: (s) => s.counselorName ?? <span className="text-muted-foreground">Unassigned</span>,
            sortValue: (s) => s.counselorName,
            searchValue: (s) => s.counselorName ?? '',
            hideBelow: 'lg',
          },
        ] satisfies Column<StudentSummary>[])
      : []),
    {
      id: 'application',
      header: 'Latest application',
      cell: (s) =>
        s.latestApplicationStatus ? (
          <StatusBadge kind="application" status={s.latestApplicationStatus} />
        ) : (
          <span className="text-muted-foreground">None</span>
        ),
      hideBelow: 'md',
    },
    {
      id: 'documents',
      header: 'Documents',
      cell: (s) => (
        <div className="flex flex-wrap gap-1">
          {s.documentsPending > 0 && <Badge tone="warning">{s.documentsPending} to review</Badge>}
          {s.documentsAction > 0 && <Badge tone="danger">{s.documentsAction} to re-upload</Badge>}
          {s.documentsPending + s.documentsAction === 0 && (
            <span className="text-muted-foreground">Up to date</span>
          )}
        </div>
      ),
      sortValue: (s) => s.documentsPending + s.documentsAction,
      hideBelow: 'sm',
    },
    {
      id: 'seen',
      header: 'Last active',
      cell: (s) => (
        <span className="whitespace-nowrap" title={s.lastSeenAt ? formatDate(s.lastSeenAt) : undefined}>
          {s.lastSeenAt ? timeAgo(s.lastSeenAt) : 'Never'}
        </span>
      ),
      sortValue: (s) => s.lastSeenAt,
      hideBelow: 'lg',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (s) => (
        <Badge tone={s.isActive ? 'success' : 'neutral'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>
      ),
      sortValue: (s) => (s.isActive ? 1 : 0),
    },
  ]

  return (
    <>
      <PageHeader
        title={isAdmin ? 'Students' : 'My students'}
        description={isAdmin ? 'Every student on the platform.' : 'Students assigned to you.'}
        actions={
          isAdmin && (
            <Button onClick={() => setAdding(true)}>
              <UserPlus /> {user.roles.includes('super_admin') ? 'Add user' : 'Add student'}
            </Button>
          )
        }
      />
      <DataTable
        caption="Students"
        columns={columns}
        data={rows}
        getRowId={(s) => s.id}
        isLoading={directory.isPending}
        error={directory.error}
        onRetry={() => void directory.refetch()}
        onRowClick={(s) => navigate(`/admin/students/${s.id}`)}
        searchPlaceholder="Search name, email, ID or phone"
        initialSort={{ columnId: 'name', direction: 'asc' }}
        pageSize={20}
        empty={{
          title: directory.data?.length
            ? 'No students match these filters'
            : isAdmin
              ? 'No students yet'
              : 'No students assigned yet',
          description: directory.data?.length
            ? 'Try clearing a filter.'
            : isAdmin
              ? 'Students appear here when they register or when you add one.'
              : 'An admin assigns students to you.',
        }}
        toolbar={
          <div className="flex flex-col gap-2 sm:flex-row">
            <NativeSelect
              aria-label="Filter by status"
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              className="sm:w-44"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="attention">Documents outstanding</option>
            </NativeSelect>
            {isAdmin && (
              <NativeSelect
                aria-label="Filter by counselor"
                value={counselor}
                onChange={(e) => setCounselor(e.target.value)}
                className="sm:w-44"
              >
                <option value="">All counselors</option>
                <option value="none">Unassigned</option>
                {counselors.map(([id, n]) => (
                  <option key={id} value={id}>
                    {n}
                  </option>
                ))}
              </NativeSelect>
            )}
            <NativeSelect
              aria-label="Filter by country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="sm:w-40"
            >
              <option value="">All countries</option>
              {countries.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </NativeSelect>
          </div>
        }
      />
      {isAdmin && (
        <AddUserDialog
          open={adding}
          onOpenChange={setAdding}
          canCreateStaff={user.roles.includes('super_admin')}
        />
      )}
    </>
  )
}
