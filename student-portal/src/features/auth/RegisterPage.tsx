import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { FormField } from '@/components/shared/FormField'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { FormAlert } from '@/features/auth/FormAlert'
import { PasswordChecklist } from '@/features/auth/PasswordChecklist'
import { PasswordInput } from '@/features/auth/PasswordInput'
import { registerSchema, type RegisterValues } from '@/features/auth/schemas'
import { COUNTRIES } from '@/lib/constants'
import { toFriendlyMessage } from '@/lib/errors'
import { register as registerAccount } from '@/services/auth'

export function RegisterPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    defaultValues: { firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '' },
  })
  const { errors, isSubmitting } = form.formState
  const password = form.watch('password')

  async function onSubmit(values: RegisterValues) {
    setError(null)
    try {
      const { needsVerification } = await registerAccount(values)
      // Without email confirmation a session exists already and <GuestOnly> takes over.
      if (needsVerification)
        navigate(`/verify-email?email=${encodeURIComponent(values.email)}&sent=1`, { replace: true })
    } catch (e) {
      setError(toFriendlyMessage(e))
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Free for students. It takes about two minutes."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        {error && <FormAlert>{error}</FormAlert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="First name" error={errors.firstName?.message} required>
            <Input autoComplete="given-name" {...form.register('firstName')} />
          </FormField>
          <FormField label="Last name" error={errors.lastName?.message} required>
            <Input autoComplete="family-name" {...form.register('lastName')} />
          </FormField>
        </div>
        <FormField label="Email" error={errors.email?.message} required>
          <Input type="email" autoComplete="email" inputMode="email" {...form.register('email')} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Phone" error={errors.phone?.message} hint="Include your country code" required>
            <Input
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="+94 77 123 4567"
              {...form.register('phone')}
            />
          </FormField>
          <FormField label="Country" error={errors.country?.message} required>
            <NativeSelect autoComplete="country-name" defaultValue="" {...form.register('country')}>
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
        <FormField label="Password" error={errors.password?.message} required>
          <PasswordInput autoComplete="new-password" {...form.register('password')} />
        </FormField>
        <PasswordChecklist value={password ?? ''} />
        <FormField label="Confirm password" error={errors.confirmPassword?.message} required>
          <PasswordInput autoComplete="new-password" {...form.register('confirmPassword')} />
        </FormField>
        <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" />}
          Create account
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          We&apos;ll send a link to verify your email. Your data is only shared with your counselor and the
          universities you apply to.
        </p>
      </form>
    </AuthLayout>
  )
}
