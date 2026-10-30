import { lazy, Suspense, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/shared/FormField'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { FormAlert } from '@/features/auth/FormAlert'
import { PasswordInput } from '@/features/auth/PasswordInput'
import { loginSchema, type LoginValues } from '@/features/auth/schemas'
import { toFriendlyMessage } from '@/lib/errors'
import { signIn } from '@/services/auth'

// Compared inline so production builds with the flag off drop the panel and its credentials entirely.
const DemoLoginPanel =
  import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true'
    ? lazy(() => import('@/features/auth/DemoLoginPanel'))
    : null

export function LoginPage() {
  const [error, setError] = useState<{ message: string; unverified: boolean } | null>(null)
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: LoginValues) {
    setError(null)
    try {
      // On success the auth state changes and <GuestOnly> redirects to the right dashboard.
      await signIn(values.email, values.password)
    } catch (e) {
      const message = toFriendlyMessage(e)
      setError({ message, unverified: /verify your email/i.test(message) })
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue your journey."
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        {error && (
          <FormAlert>
            {error.message}
            {error.unverified && (
              <>
                {' '}
                <Link
                  to={`/verify-email?email=${encodeURIComponent(form.getValues('email'))}`}
                  className="font-medium underline"
                >
                  Resend the link
                </Link>
              </>
            )}
          </FormAlert>
        )}
        <FormField label="Email" error={form.formState.errors.email?.message} required>
          <Input type="email" autoComplete="email" inputMode="email" {...form.register('email')} />
        </FormField>
        <FormField
          label="Password"
          error={form.formState.errors.password?.message}
          required
          labelAction={
            <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          }
        >
          <PasswordInput autoComplete="current-password" {...form.register('password')} />
        </FormField>
        <Button type="submit" className="w-full" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
          Sign in
        </Button>
      </form>
      {DemoLoginPanel && (
        <Suspense fallback={null}>
          <DemoLoginPanel onError={(message) => setError({ message, unverified: false })} />
        </Suspense>
      )}
    </AuthLayout>
  )
}
