import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Pencil, UserCog, UserRoundCheck, UserRoundX } from 'lucide-react'
import { useCurrentUser } from '@/app/providers/auth-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { CardSkeleton } from '@/components/shared/Skeletons'
import { useSetAccountActive, useStudentSummary } from '@/features/admin/queries'
import { AssignCounselorDialog, EditStudentDialog } from '@/features/admin/students/StudentDialogs'
import {
  ApplicationsTab,
  AuditTab,
  DocumentsTab,
  LearningTab,
  MessagesTab,
  PaymentsTab,
  ProfileTab,
} from '@/features/admin/students/StudentTabs'
import { timeAgo } from '@/lib/format'
import { hasAnyRole } from '@/lib/roles'

const TABS = ['profile', 'applications', 'documents', 'learning', 'payments', 'messages', 'audit'] as const
type Tab = (typeof TABS)[number]

export function StudentDetailPage() {
  const { studentId = '' } = useParams()
  const user = useCurrentUser()
  const isAdmin = hasAnyRole(user.roles, ['admin', 'super_admin'])
  const summary = useStudentSummary(studentId)
  const setActive = useSetAccountActive()
  const [params, setParams] = useSearchParams()
  const [dialog, setDialog] = useState<'edit' | 'assign' | 'status' | null>(null)
  const tabs = TABS.filter((t) => t !== 'audit' || isAdmin)
  const tab = (tabs as readonly string[]).includes(params.get('tab') ?? '')
    ? (params.get('tab') as Tab)
    : 'profile'

  const back = (
    <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
      <Link to="/admin/students">
        <ArrowLeft /> Students
      </Link>
    </Button>
  )

  if (summary.isPending)
    return (
      <>
        {back}
        <CardSkeleton lines={3} />
      </>
    )
  if (summary.isError)
    return (
      <>
        {back}
        <Card>
          <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
        </Card>
      </>
    )
  const s = summary.data
  if (!s)
    // RLS hides students the caller may not see, so "missing" and "not yours" look the same on purpose
    return (
      <>
        {back}
        <Card>
          <EmptyState
            title="Student not found"
            description="They may not exist, or they aren't assigned to you."
          />
        </Card>
      </>
    )

  return (
    <>
      {back}
      <PageHeader
        eyebrow={<span className="tabular">{s.studentNumber}</span>}
        title={s.name || s.email}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{s.email}</span>
            <Badge tone={s.isActive ? 'success' : 'neutral'}>{s.isActive ? 'Active' : 'Deactivated'}</Badge>
            <span>Counselor: {s.counselorName ?? 'Unassigned'}</span>
            <span>Last active {s.lastSeenAt ? timeAgo(s.lastSeenAt) : 'never'}</span>
          </span>
        }
        actions={
          isAdmin && (
            <>
              <Button variant="outline" onClick={() => setDialog('edit')}>
                <Pencil /> Edit
              </Button>
              <Button variant="outline" onClick={() => setDialog('assign')}>
                <UserCog /> Assign counselor
              </Button>
              <Button variant={s.isActive ? 'outline' : 'default'} onClick={() => setDialog('status')}>
                {s.isActive ? <UserRoundX /> : <UserRoundCheck />} {s.isActive ? 'Deactivate' : 'Reactivate'}
              </Button>
            </>
          )
        }
      />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList aria-label="Student sections">
          {tabs.map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="profile">
          <ProfileTab student={s} />
        </TabsContent>
        <TabsContent value="applications">
          <ApplicationsTab studentId={s.id} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsTab studentId={s.id} studentName={s.name} />
        </TabsContent>
        <TabsContent value="learning">
          <LearningTab studentId={s.id} />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsTab studentId={s.id} />
        </TabsContent>
        <TabsContent value="messages">
          <MessagesTab studentId={s.id} />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="audit">
            <AuditTab studentId={s.id} />
          </TabsContent>
        )}
      </Tabs>
      {isAdmin && (
        <>
          <EditStudentDialog
            student={s}
            open={dialog === 'edit'}
            onOpenChange={(o) => setDialog(o ? 'edit' : null)}
          />
          <AssignCounselorDialog
            student={s}
            open={dialog === 'assign'}
            onOpenChange={(o) => setDialog(o ? 'assign' : null)}
          />
          <ConfirmDialog
            open={dialog === 'status'}
            onOpenChange={(o) => setDialog(o ? 'status' : null)}
            title={s.isActive ? `Deactivate ${s.name}?` : `Reactivate ${s.name}?`}
            description={
              s.isActive
                ? 'They are signed out of every page and can no longer read their data until reactivated. Nothing is deleted.'
                : 'They can sign in again and see their data.'
            }
            confirmLabel={s.isActive ? 'Deactivate' : 'Reactivate'}
            destructive={s.isActive}
            onConfirm={() =>
              setActive
                .mutateAsync({ profileId: s.profileId, studentId: s.id, active: !s.isActive })
                .then(() => setDialog(null))
            }
          />
        </>
      )}
    </>
  )
}
