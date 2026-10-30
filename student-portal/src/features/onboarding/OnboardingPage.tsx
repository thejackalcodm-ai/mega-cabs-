import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, PartyPopper } from 'lucide-react'
import { useCurrentUser } from '@/app/providers/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ErrorState } from '@/components/shared/ErrorState'
import { CardSkeleton } from '@/components/shared/Skeletons'
import { toast } from '@/components/shared/toast'
import {
  EducationForm,
  EnglishTestForm,
  GoalsForm,
  PassportForm,
  PersonalForm,
  PreferencesForm,
} from '@/features/profile/forms'
import { saves } from '@/features/profile/ProfileSaves'
import { profileKeys, useProfileCompletion, useStudentProfile } from '@/features/profile/queries'
import { recordDefaults, sectionDefaults } from '@/features/profile/sections'
import { cn } from '@/lib/utils'
import { saveOnboardingProgress } from '@/services/profile'

const ONBOARDING_STEPS = [
  { title: 'Personal information', description: 'As it appears on your passport.' },
  { title: 'Education', description: 'Your highest or most recent qualification.' },
  { title: 'English test', description: 'IELTS, PTE, TOEFL or another test.' },
  { title: 'Passport', description: 'Needed for applications and visas.' },
  { title: 'Study preferences', description: 'Where, what and when you want to study.' },
  { title: 'Application goals', description: 'What you want to achieve.' },
] as const

const SKIPPABLE = new Set([2, 3, 4])
const SKIP_LABEL: Record<number, string> = {
  2: "I'll add this later",
  3: "I haven't taken a test yet",
  4: "I don't have a passport yet",
}

export function OnboardingPage() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const profile = useStudentProfile()
  const [step, setStep] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const done = step === 7

  // Resume where the student left off.
  useEffect(() => {
    if (profile.data && step === null)
      setStep(
        Math.min(
          Math.max(profile.data.student.onboarding_step, 1),
          profile.data.student.onboarding_completed ? 7 : 6,
        ),
      )
  }, [profile.data, step])

  if (profile.isError)
    return (
      <Card>
        <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
      </Card>
    )
  if (profile.isPending || step === null)
    return (
      <div className="mx-auto max-w-2xl">
        <CardSkeleton lines={6} />
      </div>
    )

  const p = profile.data
  const def = sectionDefaults(p)
  const sid = user.studentId!

  async function advance(save?: () => Promise<unknown>) {
    setBusy(true)
    try {
      if (save) await save()
      const next = step! + 1
      await saveOnboardingProgress(next, next === 7)
      await Promise.all([
        qc.invalidateQueries({ queryKey: profileKeys.bundle(sid) }),
        qc.invalidateQueries({ queryKey: profileKeys.completion(sid) }),
        qc.invalidateQueries({ queryKey: ['current-user'] }),
      ])
      setStep(next)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      toast.error(e, "Couldn't save this step")
      throw e
    } finally {
      setBusy(false)
    }
  }
  const submit =
    <T,>(save: (v: T) => Promise<unknown>) =>
    (v: T) =>
      advance(() => save(v)).catch(() => undefined)

  const back = step > 1 && !done && (
    <Button type="button" variant="ghost" onClick={() => setStep(step - 1)} disabled={busy}>
      <ArrowLeft /> Back
    </Button>
  )
  const skip = SKIPPABLE.has(step) && (
    <Button type="button" variant="link" className="px-0" onClick={() => void advance()} disabled={busy}>
      {SKIP_LABEL[step]}
    </Button>
  )
  const actions = (
    <>
      {back}
      {skip}
    </>
  )
  const formProps = { submitLabel: step === 6 ? 'Finish' : 'Save and continue', extraActions: actions }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Set up your profile
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold">
          {done ? "You're all set" : `Welcome, ${user.firstName}`}
        </h1>
      </div>

      {!done && (
        <nav aria-label="Setup progress" className="mb-6">
          <p className="mb-2 text-sm text-muted-foreground sm:hidden">
            Step {step} of {ONBOARDING_STEPS.length}: {ONBOARDING_STEPS[step - 1].title}
          </p>
          <Progress value={((step - 1) / ONBOARDING_STEPS.length) * 100} className="sm:hidden" aria-hidden />
          <ol className="hidden gap-2 sm:grid sm:grid-cols-6">
            {ONBOARDING_STEPS.map((s, i) => {
              const n = i + 1
              const state = n < step ? 'done' : n === step ? 'current' : 'todo'
              return (
                <li key={s.title} aria-current={state === 'current' ? 'step' : undefined}>
                  <button
                    type="button"
                    disabled={n > Math.max(p.student.onboarding_step, step) || busy}
                    onClick={() => setStep(n)}
                    className="group w-full text-left disabled:cursor-default"
                  >
                    <span
                      className={cn('block h-1 rounded-full', state === 'todo' ? 'bg-muted' : 'bg-primary')}
                    />
                    <span
                      className={cn(
                        'mt-2 flex items-center gap-1 text-xs',
                        state === 'current' ? 'font-semibold text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {state === 'done' && <Check className="size-3 text-primary" aria-hidden />}
                      {s.title}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>
      )}

      {done ? (
        <OnboardingComplete />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {step}. {ONBOARDING_STEPS[step - 1].title}
            </CardTitle>
            <CardDescription>{ONBOARDING_STEPS[step - 1].description}</CardDescription>
          </CardHeader>
          <CardContent>
            {step === 1 && (
              <PersonalForm
                key="1"
                defaultValues={def.personal}
                onSubmit={submit(saves.personal(sid, user.id))}
                {...formProps}
              />
            )}
            {step === 2 && (
              <EducationForm
                key="2"
                defaultValues={p.education[0] ? recordDefaults.education(p.education[0]) : {}}
                onSubmit={submit(saves.education(sid))}
                {...formProps}
              />
            )}
            {step === 3 && (
              <EnglishTestForm
                key="3"
                defaultValues={p.english[0] ? recordDefaults.english(p.english[0]) : {}}
                onSubmit={submit(saves.english(sid))}
                {...formProps}
              />
            )}
            {step === 4 && (
              <PassportForm
                key="4"
                defaultValues={def.passport}
                onSubmit={submit(saves.passport(sid))}
                {...formProps}
              />
            )}
            {step === 5 && (
              <PreferencesForm
                key="5"
                defaultValues={def.preferences}
                onSubmit={submit(saves.preferences(sid))}
                {...formProps}
              />
            )}
            {step === 6 && (
              <GoalsForm
                key="6"
                defaultValues={def.goals}
                onSubmit={submit(saves.goals(sid))}
                {...formProps}
              />
            )}
          </CardContent>
        </Card>
      )}
      {!done && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Your answers are saved after each step.{' '}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => navigate('/app?setup=later')}
          >
            Finish later
          </button>
        </p>
      )}
    </div>
  )
}

function OnboardingComplete() {
  const completion = useProfileCompletion()
  if (completion.isPending) return <CardSkeleton lines={4} />
  if (completion.isError)
    return (
      <Card>
        <ErrorState error={completion.error} onRetry={() => void completion.refetch()} />
      </Card>
    )
  const c = completion.data
  return (
    <Card className="text-center">
      <CardContent className="space-y-5 p-8">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
          <PartyPopper className="size-7" aria-hidden />
        </span>
        <div>
          <p className="font-display text-2xl font-semibold">Your profile is {c.percent}% complete.</p>
          <p className="mt-1 text-muted-foreground">
            {c.missing.length === 0
              ? 'Everything universities need is in place.'
              : 'Add the remaining details any time from My Profile.'}
          </p>
        </div>
        <Progress value={c.percent} aria-hidden />
        {c.missing.length > 0 && (
          <ul className="flex flex-wrap justify-center gap-1.5">
            {c.missing.map((m) => (
              <li key={m.key} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
                {m.label}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link to="/app">Go to my dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/app/profile">Complete my profile</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
