import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/app/providers/auth-context'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/shared/FormField'
import { FullPageLoader } from '@/components/shared/FullPageLoader'
import { toast } from '@/components/shared/toast'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { FormAlert } from '@/features/auth/FormAlert'
import { PasswordChecklist } from '@/features/auth/PasswordChecklist'
import { PasswordInput } from '@/features/auth/PasswordInput'
import { resetPasswordSchema, type ResetPasswordValues } from '@/features/auth/schemas'
import { toFriendlyMessage } from '@/lib/errors'
import { homePathFor } from '@/lib/roles'
import { updatePassword } from '@/services/auth'

export function ResetPasswordPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  if (auth.status === 'loading') return <FullPageLoader />

  if (auth.status === 'signed_out') {
    return (
      <AuthLayout
        title="This link has expired"
        subtitle="Password reset links work once and expire after an hour."
      >
        <Button asChild className="w-full" size="lg">
          <Link to="/forgot-password">Request a new link</Link>
        </Button>
      </AuthLayout>
    )
  }

  async function onSubmit({ password }: ResetPasswordValues) {
    setError(null)
    try {
      await updatePassword(password)
      toast.success('Password updated', 'You are signed in with your new password.')
      navigate(homePathFor(auth.user?.primaryRole), { replace: true })
    } catch (e) {
      setError(toFriendlyMessage(e))
    }
  }

  return (
    <AuthLayout title="Choose a new password" subtitle={auth.session?.user.email}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
        {error && <FormAlert>{error}</FormAlert>}
        <FormField label="New password" error={form.formState.errors.password?.message} required>
          <PasswordInput autoComplete="new-password" {...form.register('password')} />
        </FormField>
        <PasswordChecklist value={form.watch('password') ?? ''} />
        <FormField
          label="Confirm new password"
          error={form.formState.errors.confirmPassword?.message}
          required
        >
          <PasswordInput autoComplete="new-password" {...form.register('confirmPassword')} />
        </FormField>
        <Button type="submit" className="w-full" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
          Update password
        </Button>
      </form>
    </AuthLayout>
  )
}
