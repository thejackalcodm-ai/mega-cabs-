import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpenCheck,
  Briefcase,
  CheckCircle2,
  GraduationCap,
  Languages,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useCurrentUser } from '@/app/providers/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageHeader } from '@/components/shared/PageHeader'
import { CardSkeleton } from '@/components/shared/Skeletons'
import {
  ContactForm,
  EducationForm,
  EmergencyForm,
  EnglishTestForm,
  GoalsForm,
  PassportForm,
  PersonalForm,
  PreferencesForm,
  WorkForm,
} from '@/features/profile/forms'
import { saves } from '@/features/profile/ProfileSaves'
import { useProfileCompletion, useProfileSave, useStudentProfile } from '@/features/profile/queries'
import { recordDefaults, SECTION_ANCHOR, sectionDefaults } from '@/features/profile/sections'
import { ENGLISH_TESTS, STUDY_LEVELS } from '@/lib/constants'
import { formatDate } from '@/lib/format'
import { deleteListRecord, type StudentProfileBundle } from '@/services/profile'

type Row = [label: string, value: React.ReactNode]

function Details({ rows }: { rows: Row[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="break-words text-sm">
            {value || <span className="text-muted-foreground">Not provided</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** A card that toggles between read-only details and its edit form. */
function Section({
  id,
  title,
  description,
  rows,
  children,
}: {
  id: string
  title: string
  description?: string
  rows: Row[]
  children: (close: () => void) => React.ReactNode
}) {
  const [editing, setEditing] = useState(false)
  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {!editing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${title.toLowerCase()}`}
          >
            <Pencil /> Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>{editing ? children(() => setEditing(false)) : <Details rows={rows} />}</CardContent>
    </Card>
  )
}

type ListKind = 'education' | 'english' | 'work'
const LIST_META: Record<
  ListKind,
  {
    title: string
    table: 'education_records' | 'english_tests' | 'work_experience'
    icon: typeof GraduationCap
    empty: string
    noun: string
  }
> = {
  education: {
    title: 'Education',
    table: 'education_records',
    icon: GraduationCap,
    empty: 'Add your most recent qualification first.',
    noun: 'qualification',
  },
  english: {
    title: 'English language tests',
    table: 'english_tests',
    icon: Languages,
    empty: 'Add an IELTS, PTE, TOEFL or other test result.',
    noun: 'test result',
  },
  work: {
    title: 'Work experience',
    table: 'work_experience',
    icon: Briefcase,
    empty: 'Optional, but it strengthens many applications.',
    noun: 'role',
  },
}

function ListSection({ kind, profile }: { kind: ListKind; profile: StudentProfileBundle }) {
  const user = useCurrentUser()
  const meta = LIST_META[kind]
  const [editing, setEditing] = useState<{ id?: string } | null>(null)
  const [deleting, setDeleting] = useState<{ id: string; label: string } | null>(null)
  const save = useProfileSave(
    saves[kind](user.studentId!) as (v: unknown) => Promise<unknown>,
    `${meta.noun[0].toUpperCase()}${meta.noun.slice(1)} saved`,
  )
  const remove = useProfileSave((id: string) => deleteListRecord(meta.table, id), 'Removed')

  const items: { id: string; title: string; subtitle: string; meta: string }[] =
    kind === 'education'
      ? profile.education.map((e) => ({
          id: e.id,
          title: `${e.qualification}${e.field_of_study ? `, ${e.field_of_study}` : ''}`,
          subtitle: e.institution,
          meta: [e.grade, e.graduation_year && `Graduated ${e.graduation_year}`].filter(Boolean).join(' · '),
        }))
      : kind === 'english'
        ? profile.english.map((t) => ({
            id: t.id,
            title: `${t.test_name || ENGLISH_TESTS.find((x) => x.value === t.test_type)?.label}: ${t.overall ?? '—'} overall`,
            subtitle: ['listening', 'reading', 'writing', 'speaking']
              .map((k) => `${k[0].toUpperCase()} ${t[k as 'listening'] ?? '—'}`)
              .join(' · '),
            meta: `Taken ${formatDate(t.test_date)}`,
          }))
        : profile.work.map((w) => ({
            id: w.id,
            title: w.position,
            subtitle: w.company,
            meta: `${formatDate(w.start_date, 'MMM yyyy')} – ${w.is_current ? 'present' : formatDate(w.end_date, 'MMM yyyy')}`,
          }))

  const editingRecord =
    editing?.id &&
    (kind === 'education'
      ? recordDefaults.education(profile.education.find((r) => r.id === editing.id)!)
      : kind === 'english'
        ? recordDefaults.english(profile.english.find((r) => r.id === editing.id)!)
        : recordDefaults.work(profile.work.find((r) => r.id === editing.id)!))
  const formProps = {
    defaultValues: (editingRecord || {}) as never,
    onSubmit: async (v: unknown) => {
      await save.mutateAsync(v)
      setEditing(null)
    },
    onCancel: () => setEditing(null),
    submitLabel: editing?.id ? 'Save changes' : `Add ${meta.noun}`,
  }

  return (
    <Card id={SECTION_ANCHOR[kind] ?? kind} className="scroll-mt-24">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <CardTitle>{meta.title}</CardTitle>
        <Button variant="outline" size="sm" onClick={() => setEditing({})}>
          <Plus /> Add
        </Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState compact icon={meta.icon} title={`No ${meta.noun}s yet`} description={meta.empty} />
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <meta.icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.subtitle}</p>
                  {item.meta && <p className="text-xs text-muted-foreground">{item.meta}</p>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditing({ id: item.id })}
                  aria-label={`Edit ${item.title}`}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleting({ id: item.id, label: item.title })}
                  aria-label={`Delete ${item.title}`}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? `Edit ${meta.noun}` : `Add ${meta.noun}`}</DialogTitle>
            <DialogDescription>{meta.title}</DialogDescription>
          </DialogHeader>
          {kind === 'education' && <EducationForm {...formProps} />}
          {kind === 'english' && <EnglishTestForm {...formProps} />}
          {kind === 'work' && <WorkForm {...formProps} />}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Remove this ${meta.noun}?`}
        description={deleting?.label}
        confirmLabel="Remove"
        destructive
        onConfirm={() => remove.mutateAsync(deleting!.id)}
      />
    </Card>
  )
}

function CompletionCard() {
  const completion = useProfileCompletion()
  if (completion.isPending) return <CardSkeleton lines={4} />
  if (completion.isError)
    return (
      <Card>
        <ErrorState compact error={completion.error} onRetry={() => void completion.refetch()} />
      </Card>
    )
  const c = completion.data
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile completion</CardTitle>
        <CardDescription>
          {c.completed} of {c.total} items complete
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="tabular font-display text-4xl font-semibold">{c.percent}%</p>
        <Progress value={c.percent} aria-label={`Profile ${c.percent}% complete`} />
        {c.missing.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-status-success">
            <CheckCircle2 className="size-4" aria-hidden /> Everything universities need is here.
          </p>
        ) : (
          <div>
            <p className="mb-2 text-sm font-medium">Missing information</p>
            <ul className="space-y-1">
              {c.missing.map((m) => (
                <li key={m.key}>
                  <a
                    href={`#${SECTION_ANCHOR[m.section] ?? m.section}`}
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    {m.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ProfilePage() {
  const user = useCurrentUser()
  const profile = useStudentProfile()
  const sid = user.studentId!
  const personal = useProfileSave(saves.personal(sid, user.id), 'Personal information saved')
  const passport = useProfileSave(saves.passport(sid), 'Passport details saved')
  const contact = useProfileSave(saves.contact(sid, user.id), 'Contact details saved')
  const emergency = useProfileSave(saves.emergency(sid), 'Emergency contact saved')
  const preferences = useProfileSave(saves.preferences(sid), 'Study preferences saved')
  const goals = useProfileSave(saves.goals(sid), 'Goals saved')

  if (profile.isPending) {
    return (
      <>
        <PageHeader title="My profile" />
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <CardSkeleton lines={5} />
            <CardSkeleton lines={4} />
          </div>
          <CardSkeleton lines={4} />
        </div>
      </>
    )
  }
  if (profile.isError) {
    return (
      <>
        <PageHeader title="My profile" />
        <Card>
          <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
        </Card>
      </>
    )
  }
  const p = profile.data
  const d = p.details
  const def = sectionDefaults(p)
  const closing =
    <T,>(m: { mutateAsync: (v: T) => Promise<unknown> }, close: () => void) =>
    async (v: T) => {
      await m.mutateAsync(v)
      close()
    }

  return (
    <>
      <PageHeader title="My profile" description={`Student ID ${p.student.student_number}`} />
      <div className="grid items-start gap-5 lg:grid-cols-3">
        <div className="order-2 space-y-5 lg:order-1 lg:col-span-2">
          <Section
            id="personal"
            title="Personal information"
            rows={[
              ['Name', `${p.account.first_name} ${p.account.last_name}`],
              ['Date of birth', d?.date_of_birth && formatDate(d.date_of_birth)],
              ['Gender', d?.gender],
              ['Nationality', d?.nationality],
              ['NIC / national ID', d?.national_id],
            ]}
          >
            {(close) => (
              <PersonalForm
                defaultValues={def.personal}
                onSubmit={closing(personal, close)}
                onCancel={close}
              />
            )}
          </Section>
          <Section
            id="passport"
            title="Passport"
            rows={[
              ['Passport number', d?.passport_number],
              ['Expiry date', d?.passport_expiry && formatDate(d.passport_expiry)],
            ]}
          >
            {(close) => (
              <PassportForm
                defaultValues={def.passport}
                onSubmit={closing(passport, close)}
                onCancel={close}
              />
            )}
          </Section>
          <Section
            id="contact"
            title="Contact"
            rows={[
              ['Email', p.account.email],
              ['Phone', p.account.phone],
              ['WhatsApp', d?.whatsapp],
              ['Address', d?.address_line],
              ['City', d?.city],
              ['Country', d?.country ?? p.account.country],
            ]}
          >
            {(close) => (
              <ContactForm
                email={p.account.email}
                defaultValues={def.contact}
                onSubmit={closing(contact, close)}
                onCancel={close}
              />
            )}
          </Section>
          <ListSection kind="education" profile={p} />
          <ListSection kind="english" profile={p} />
          <ListSection kind="work" profile={p} />
          <Section
            id="emergency"
            title="Emergency contact"
            rows={[
              ['Name', d?.emergency_name],
              ['Relationship', d?.emergency_relationship],
              ['Phone', d?.emergency_phone],
              ['Email', d?.emergency_email],
            ]}
          >
            {(close) => (
              <EmergencyForm
                defaultValues={def.emergency}
                onSubmit={closing(emergency, close)}
                onCancel={close}
              />
            )}
          </Section>
          <Section
            id="preferences"
            title="Study preferences"
            rows={[
              ['Destinations', p.student.preferred_destinations.join(', ')],
              ['Study level', STUDY_LEVELS.find((l) => l.value === p.student.preferred_study_level)?.label],
              ['Intake', p.student.preferred_intake],
              ['Subjects', p.student.preferred_subjects.join(', ')],
              ['Budget', p.student.budget_max ? p.student.budget_max.toLocaleString() : null],
            ]}
          >
            {(close) => (
              <PreferencesForm
                defaultValues={def.preferences}
                onSubmit={closing(preferences, close)}
                onCancel={close}
              />
            )}
          </Section>
          <Section
            id="goals"
            title="Application goals"
            rows={[
              [
                'Goals',
                p.student.application_goals && (
                  <span className="whitespace-pre-line">{p.student.application_goals}</span>
                ),
              ],
            ]}
          >
            {(close) => (
              <GoalsForm defaultValues={def.goals} onSubmit={closing(goals, close)} onCancel={close} />
            )}
          </Section>
        </div>
        <aside className="order-1 space-y-4 lg:sticky lg:top-24 lg:order-2" aria-label="Profile completion">
          <CompletionCard />
          {!p.student.onboarding_completed && (
            <Card className="border-dashed p-4 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <BookOpenCheck className="size-4 text-primary" aria-hidden /> Prefer a guided setup?
              </p>
              <Link to="/app/onboarding" className="mt-1 inline-block text-primary hover:underline">
                Continue the step-by-step setup
              </Link>
            </Card>
          )}
        </aside>
      </div>
    </>
  )
}
