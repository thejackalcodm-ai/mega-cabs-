import { forwardRef } from 'react'
import { useForm, type DefaultValues, type FieldValues } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/shared/FormField'
import {
  contactSchema,
  educationSchema,
  emergencySchema,
  englishSchema,
  goalsSchema,
  passportSchema,
  personalSchema,
  preferencesSchema,
  workSchema,
} from '@/features/profile/schemas'
import {
  COUNTRIES,
  ENGLISH_TESTS,
  GENDERS,
  STUDY_DESTINATIONS,
  STUDY_LEVELS,
  upcomingIntakes,
} from '@/lib/constants'
import { cn } from '@/lib/utils'

/**
 * Section forms shared by onboarding and the profile page. Each takes default values and an async
 * onSubmit that receives schema-validated output; errors are reported by the caller (toast).
 */
export interface SectionFormProps<S extends z.ZodTypeAny> {
  defaultValues: Partial<z.input<S>>
  onSubmit: (values: z.output<S>) => Promise<unknown>
  submitLabel?: string
  onCancel?: () => void
  /** Extra buttons rendered next to submit (e.g. "Back" in the wizard). */
  extraActions?: React.ReactNode
}

function useSectionForm<S extends z.ZodTypeAny>(schema: S, defaultValues: Partial<z.input<S>>) {
  return useForm<z.input<S> & FieldValues, unknown, z.output<S>>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as DefaultValues<z.input<S> & FieldValues>,
    mode: 'onTouched',
  })
}

function FormActions({
  busy,
  submitLabel = 'Save',
  onCancel,
  extraActions,
}: {
  busy: boolean
  submitLabel?: string
  onCancel?: () => void
  extraActions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      {extraActions}
      <div className="ml-auto flex gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}

/** Labelled input; spread `form.register(name)` into it. */
const Text = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    label: string
    error?: string
    hint?: string
    wrapperClassName?: string
  }
>(({ label, error, hint, required, wrapperClassName, ...input }, ref) => (
  <FormField label={label} error={error} required={required} hint={hint} className={wrapperClassName}>
    <Input ref={ref} {...input} />
  </FormField>
))
Text.displayName = 'Text'

const errorOf = (form: { formState: { errors: object } }, name: string) =>
  (form.formState.errors as Record<string, { message?: string } | undefined>)[name]?.message

const grid = 'grid gap-4 sm:grid-cols-2'

export function PersonalForm(props: SectionFormProps<typeof personalSchema>) {
  const form = useSectionForm(personalSchema, props.defaultValues)
  return (
    <form noValidate onSubmit={form.handleSubmit(props.onSubmit)} className="space-y-4">
      <div className={grid}>
        <Text
          error={errorOf(form, 'first_name')}
          {...form.register('first_name')}
          label="First name"
          required
          autoComplete="given-name"
        />
        <Text
          error={errorOf(form, 'last_name')}
          {...form.register('last_name')}
          label="Last name"
          required
          autoComplete="family-name"
        />
        <Text
          error={errorOf(form, 'date_of_birth')}
          {...form.register('date_of_birth')}
          label="Date of birth"
          type="date"
          required
          autoComplete="bday"
        />
        <FormField label="Gender" required error={errorOf(form, 'gender')}>
          <NativeSelect defaultValue="" {...form.register('gender')}>
            <option value="" disabled>
              Select…
            </option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <Text
          error={errorOf(form, 'nationality')}
          {...form.register('nationality')}
          label="Nationality"
          required
          placeholder="e.g. Sri Lankan"
        />
        <Text
          error={errorOf(form, 'national_id')}
          {...form.register('national_id')}
          label="NIC / national ID number"
          hint="Optional"
        />
      </div>
      <FormActions
        busy={form.formState.isSubmitting}
        submitLabel={props.submitLabel}
        onCancel={props.onCancel}
        extraActions={props.extraActions}
      />
    </form>
  )
}

export function PassportForm(props: SectionFormProps<typeof passportSchema>) {
  const form = useSectionForm(passportSchema, props.defaultValues)
  return (
    <form noValidate onSubmit={form.handleSubmit(props.onSubmit)} className="space-y-4">
      <div className={grid}>
        <Text
          error={errorOf(form, 'passport_number')}
          {...form.register('passport_number')}
          label="Passport number"
          required
          autoCapitalize="characters"
          spellCheck={false}
        />
        <Text
          error={errorOf(form, 'passport_expiry')}
          {...form.register('passport_expiry')}
          label="Passport expiry date"
          type="date"
          required
          hint="Most visas need 6+ months of validity"
        />
      </div>
      <FormActions
        busy={form.formState.isSubmitting}
        submitLabel={props.submitLabel}
        onCancel={props.onCancel}
        extraActions={props.extraActions}
      />
    </form>
  )
}

export function ContactForm(props: SectionFormProps<typeof contactSchema> & { email: string }) {
  const form = useSectionForm(contactSchema, props.defaultValues)
  return (
    <form noValidate onSubmit={form.handleSubmit(props.onSubmit)} className="space-y-4">
      <div className={grid}>
        <FormField label="Email" hint="Change your email in Settings">
          <Input value={props.email} readOnly disabled />
        </FormField>
        <Text
          error={errorOf(form, 'phone')}
          {...form.register('phone')}
          label="Phone"
          type="tel"
          required
          autoComplete="tel"
        />
        <Text
          error={errorOf(form, 'whatsapp')}
          {...form.register('whatsapp')}
          label="WhatsApp"
          type="tel"
          hint="Optional"
        />
        <Text
          error={errorOf(form, 'address_line')}
          {...form.register('address_line')}
          label="Address"
          required
          autoComplete="street-address"
          wrapperClassName="sm:col-span-2"
        />
        <Text
          error={errorOf(form, 'city')}
          {...form.register('city')}
          label="City"
          required
          autoComplete="address-level2"
        />
        <FormField label="Country" required error={errorOf(form, 'country')}>
          <NativeSelect defaultValue="" {...form.register('country')}>
            <option value="" disabled>
              Select…
            </option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </div>
      <FormActions
        busy={form.formState.isSubmitting}
        submitLabel={props.submitLabel}
        onCancel={props.onCancel}
        extraActions={props.extraActions}
      />
    </form>
  )
}

export function EmergencyForm(props: SectionFormProps<typeof emergencySchema>) {
  const form = useSectionForm(emergencySchema, props.defaultValues)
  return (
    <form noValidate onSubmit={form.handleSubmit(props.onSubmit)} className="space-y-4">
      <div className={grid}>
        <Text
          error={errorOf(form, 'emergency_name')}
          {...form.register('emergency_name')}
          label="Full name"
          required
        />
        <Text
          error={errorOf(form, 'emergency_relationship')}
          {...form.register('emergency_relationship')}
          label="Relationship"
          required
          placeholder="e.g. Parent"
        />
        <Text
          error={errorOf(form, 'emergency_phone')}
          {...form.register('emergency_phone')}
          label="Phone"
          type="tel"
          required
        />
        <Text
          error={errorOf(form, 'emergency_email')}
          {...form.register('emergency_email')}
          label="Email"
          type="email"
          hint="Optional"
        />
      </div>
      <FormActions
        busy={form.formState.isSubmitting}
        submitLabel={props.submitLabel}
        onCancel={props.onCancel}
        extraActions={props.extraActions}
      />
    </form>
  )
}

export function EducationForm(props: SectionFormProps<typeof educationSchema>) {
  const form = useSectionForm(educationSchema, props.defaultValues)
  return (
    <form noValidate onSubmit={form.handleSubmit(props.onSubmit)} className="space-y-4">
      <div className={grid}>
        <Text
          error={errorOf(form, 'institution')}
          {...form.register('institution')}
          label="Institution"
          required
          wrapperClassName="sm:col-span-2"
        />
        <Text
          error={errorOf(form, 'qualification')}
          {...form.register('qualification')}
          label="Qualification"
          required
          placeholder="e.g. BSc, A-Levels"
        />
        <Text
          error={errorOf(form, 'field_of_study')}
          {...form.register('field_of_study')}
          label="Field of study"
        />
        <Text
          error={errorOf(form, 'start_date')}
          {...form.register('start_date')}
          label="Start date"
          type="date"
        />
        <Text error={errorOf(form, 'end_date')} {...form.register('end_date')} label="End date" type="date" />
        <Text
          error={errorOf(form, 'grade')}
          {...form.register('grade')}
          label="Grade / GPA"
          placeholder="e.g. 3.6 GPA, First Class"
        />
        <Text
          error={errorOf(form, 'graduation_year')}
          {...form.register('graduation_year')}
          label="Graduation year"
          inputMode="numeric"
        />
      </div>
      <FormActions
        busy={form.formState.isSubmitting}
        submitLabel={props.submitLabel}
        onCancel={props.onCancel}
        extraActions={props.extraActions}
      />
    </form>
  )
}

export function EnglishTestForm(props: SectionFormProps<typeof englishSchema>) {
  const form = useSectionForm(englishSchema, { test_type: 'ielts', ...props.defaultValues })
  const type = form.watch('test_type') as string
  const meta = ENGLISH_TESTS.find((t) => t.value === type) ?? ENGLISH_TESTS[0]
  const scoreProps = {
    inputMode: 'decimal' as const,
    placeholder: `${meta.min}–${'sectionMax' in meta ? meta.sectionMax : meta.max}`,
  }
  return (
    <form noValidate onSubmit={form.handleSubmit(props.onSubmit)} className="space-y-4">
      <div className={grid}>
        <FormField label="Test" required error={errorOf(form, 'test_type')}>
          <NativeSelect {...form.register('test_type')}>
            {ENGLISH_TESTS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        {type === 'other' ? (
          <Text
            error={errorOf(form, 'test_name')}
            {...form.register('test_name')}
            label="Test name"
            required
          />
        ) : (
          <div className="hidden sm:block" />
        )}
        <Text
          error={errorOf(form, 'overall')}
          {...form.register('overall')}
          label="Overall score"
          required
          inputMode="decimal"
          placeholder={`${meta.min}–${meta.max}`}
        />
        <Text
          error={errorOf(form, 'test_date')}
          {...form.register('test_date')}
          label="Test date"
          type="date"
          required
        />
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          Individual scores <span className="font-normal text-muted-foreground">(optional)</span>
        </legend>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Text
            error={errorOf(form, 'listening')}
            {...form.register('listening')}
            label="Listening"
            {...scoreProps}
          />
          <Text
            error={errorOf(form, 'reading')}
            {...form.register('reading')}
            label="Reading"
            {...scoreProps}
          />
          <Text
            error={errorOf(form, 'writing')}
            {...form.register('writing')}
            label="Writing"
            {...scoreProps}
          />
          <Text
            error={errorOf(form, 'speaking')}
            {...form.register('speaking')}
            label="Speaking"
            {...scoreProps}
          />
        </div>
      </fieldset>
      <FormActions
        busy={form.formState.isSubmitting}
        submitLabel={props.submitLabel}
        onCancel={props.onCancel}
        extraActions={props.extraActions}
      />
    </form>
  )
}

export function WorkForm(props: SectionFormProps<typeof workSchema>) {
  const form = useSectionForm(workSchema, { is_current: false, ...props.defaultValues })
  const current = form.watch('is_current')
  return (
    <form noValidate onSubmit={form.handleSubmit(props.onSubmit)} className="space-y-4">
      <div className={grid}>
        <Text error={errorOf(form, 'company')} {...form.register('company')} label="Company" required />
        <Text error={errorOf(form, 'position')} {...form.register('position')} label="Position" required />
        <Text
          error={errorOf(form, 'start_date')}
          {...form.register('start_date')}
          label="Start date"
          type="date"
          required
        />
        <Text
          error={errorOf(form, 'end_date')}
          {...form.register('end_date')}
          label="End date"
          type="date"
          disabled={!!current}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox {...form.register('is_current')} /> I work here now
      </label>
      <FormField label="Responsibilities" error={errorOf(form, 'responsibilities')}>
        <Textarea rows={3} {...form.register('responsibilities')} />
      </FormField>
      <FormActions
        busy={form.formState.isSubmitting}
        submitLabel={props.submitLabel}
        onCancel={props.onCancel}
        extraActions={props.extraActions}
      />
    </form>
  )
}

export function PreferencesForm(props: SectionFormProps<typeof preferencesSchema>) {
  const form = useSectionForm(preferencesSchema, { preferred_destinations: [], ...props.defaultValues })
  const selected = (form.watch('preferred_destinations') ?? []) as string[]
  const intakes = upcomingIntakes()
  const current = props.defaultValues.preferred_intake
  return (
    <form noValidate onSubmit={form.handleSubmit(props.onSubmit)} className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          Where would you like to study?{' '}
          <span className="text-destructive" aria-hidden>
            *
          </span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {STUDY_DESTINATIONS.map((d) => {
            const on = selected.includes(d)
            return (
              <label
                key={d}
                className={cn(
                  'cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                  on ? 'border-primary bg-primary-soft font-medium text-primary' : 'bg-card hover:bg-muted',
                )}
              >
                <input
                  type="checkbox"
                  value={d}
                  className="sr-only"
                  {...form.register('preferred_destinations')}
                />
                {d}
              </label>
            )
          })}
        </div>
        {errorOf(form, 'preferred_destinations') && (
          <p className="mt-1.5 text-xs font-medium text-destructive">
            {errorOf(form, 'preferred_destinations')}
          </p>
        )}
      </fieldset>
      <div className={grid}>
        <FormField label="Study level" required error={errorOf(form, 'preferred_study_level')}>
          <NativeSelect defaultValue="" {...form.register('preferred_study_level')}>
            <option value="" disabled>
              Select…
            </option>
            {STUDY_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Preferred intake" required error={errorOf(form, 'preferred_intake')}>
          <NativeSelect defaultValue="" {...form.register('preferred_intake')}>
            <option value="" disabled>
              Select…
            </option>
            {current && !intakes.includes(current) && <option value={current}>{current}</option>}
            {intakes.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <Text
          error={errorOf(form, 'preferred_subjects')}
          {...form.register('preferred_subjects')}
          label="Subjects"
          required
          hint="Separate with commas, e.g. Data Science, Business"
        />
        <Text
          error={errorOf(form, 'budget_max')}
          {...form.register('budget_max')}
          label="Yearly tuition budget"
          inputMode="numeric"
          hint="Optional, in your preferred currency"
        />
      </div>
      <FormActions
        busy={form.formState.isSubmitting}
        submitLabel={props.submitLabel}
        onCancel={props.onCancel}
        extraActions={props.extraActions}
      />
    </form>
  )
}

export function GoalsForm(props: SectionFormProps<typeof goalsSchema>) {
  const form = useSectionForm(goalsSchema, props.defaultValues)
  return (
    <form noValidate onSubmit={form.handleSubmit(props.onSubmit)} className="space-y-4">
      <FormField
        label="What do you want to achieve?"
        required
        error={errorOf(form, 'application_goals')}
        hint="Your counselor uses this to recommend universities and courses."
      >
        <Textarea
          rows={5}
          placeholder="e.g. I want to study a master's in data science in the UK and work in health-tech analytics."
          {...form.register('application_goals')}
        />
      </FormField>
      <FormActions
        busy={form.formState.isSubmitting}
        submitLabel={props.submitLabel}
        onCancel={props.onCancel}
        extraActions={props.extraActions}
      />
    </form>
  )
}
