import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/shared/FormField'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { FormAlert } from '@/features/auth/FormAlert'
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/features/auth/schemas'
import { toFriendlyMessage } from '@/lib/errors'
import { requestPasswordReset } from '@/services/auth'

export function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  async function onSubmit({ email }: ForgotPasswordValues) {
    setError(null)
    try {
      await requestPasswordReset(email)
      setSentTo(email)
    } catch (e) {
      setError(toFriendlyMessage(e))
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email you registered with and we'll send you a reset link."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sentTo ? (
        // Same message whether or not the account exists, so emails can't be enumerated.
        <FormAlert tone="success">
          If an account exists for <strong>{sentTo}</strong>, a reset link is on its way. It expires in one
          hour.
        </FormAlert>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          {error && <FormAlert>{error}</FormAlert>}
          <FormField label="Email" error={form.formState.errors.email?.message} required>
            <Input type="email" autoComplete="email" inputMode="email" {...form.register('email')} />
          </FormField>
          <Button type="submit" className="w-full" size="lg" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
