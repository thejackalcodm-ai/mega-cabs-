import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { ErrorState } from '@/components/shared/ErrorState'
import { FormField } from '@/components/shared/FormField'
import { CardSkeleton } from '@/components/shared/Skeletons'
import {
  useAssignCounselor,
  useCounselors,
  useCreateUser,
  useUpdateStudentAccount,
} from '@/features/admin/queries'
import {
  editStudentSchema,
  newUserSchema,
  type EditStudentValues,
  type NewUserValues,
} from '@/features/admin/students/schemas'
import { COUNTRIES } from '@/lib/constants'
import { ROLE_LABEL } from '@/lib/roles'
import type { StudentSummary } from '@/services/admin'

function CountrySelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <NativeSelect {...props}>
      <option value="">Not set</option>
      {COUNTRIES.map((c) => (
        <option key={c}>{c}</option>
      ))}
    </NativeSelect>
  )
}

/** Creates an account through the admin-create-user Edge Function. Staff roles: super admin only. */
export function AddUserDialog({
  open,
  onOpenChange,
  canCreateStaff,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  canCreateStaff: boolean
  onCreated?: (userId: string) => void
}) {
  const create = useCreateUser()
  const form = useForm<NewUserValues>({
    resolver: zodResolver(newUserSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      country: '',
      role: 'student',
      sendInvite: true,
    },
  })
  const { errors, isSubmitting } = form.formState
  useEffect(() => {
    if (open) form.reset()
  }, [open, form])

  const submit = form.handleSubmit(async (v) => {
    const r = await create.mutateAsync(v).catch(() => null)
    if (r) {
      onOpenChange(false)
      onCreated?.(r.user_id)
    }
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !isSubmitting && onOpenChange(o)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{canCreateStaff ? 'Add a user' : 'Add a student'}</DialogTitle>
          <DialogDescription>
            The account is created on the server; the person sets their own password from the email we send.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="First name" error={errors.firstName?.message} required>
              <Input {...form.register('firstName')} />
            </FormField>
            <FormField label="Last name" error={errors.lastName?.message} required>
              <Input {...form.register('lastName')} />
            </FormField>
          </div>
          <FormField label="Email" error={errors.email?.message} required>
            <Input type="email" autoComplete="off" {...form.register('email')} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Phone" error={errors.phone?.message}>
              <Input type="tel" {...form.register('phone')} />
            </FormField>
            <FormField label="Country" error={errors.country?.message}>
              <CountrySelect {...form.register('country')} />
            </FormField>
          </div>
          {canCreateStaff && (
            <FormField
              label="Role"
              error={errors.role?.message}
              required
              hint="Only a super admin can create staff accounts."
            >
              <NativeSelect {...form.register('role')}>
                {(['student', 'counselor', 'instructor', 'admin'] as const).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          )}
          <div className="flex items-center gap-2">
            <Checkbox id="send-invite" {...form.register('sendInvite')} />
            <Label htmlFor="send-invite" className="font-normal">
              Email a link to set a password
            </Label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />} Create account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function EditStudentDialog({
  student,
  open,
  onOpenChange,
}: {
  student: StudentSummary
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const update = useUpdateStudentAccount()
  const form = useForm<EditStudentValues>({ resolver: zodResolver(editStudentSchema) })
  const { errors, isSubmitting } = form.formState
  useEffect(() => {
    if (open)
      form.reset({
        firstName: student.firstName,
        lastName: student.lastName,
        phone: student.phone ?? '',
        country: (COUNTRIES as readonly string[]).includes(student.country ?? '')
          ? (student.country as EditStudentValues['country'])
          : '',
      })
  }, [open, student, form])

  const submit = form.handleSubmit(async (values) => {
    const ok = await update
      .mutateAsync({ profileId: student.profileId, studentId: student.id, values })
      .then(() => true)
      .catch(() => false)
    if (ok) onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !isSubmitting && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {student.name}</DialogTitle>
          <DialogDescription>
            Email changes are made by the student from their account settings.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="First name" error={errors.firstName?.message} required>
              <Input {...form.register('firstName')} />
            </FormField>
            <FormField label="Last name" error={errors.lastName?.message} required>
              <Input {...form.register('lastName')} />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Phone" error={errors.phone?.message}>
              <Input type="tel" {...form.register('phone')} />
            </FormField>
            <FormField label="Country" error={errors.country?.message}>
              <CountrySelect {...form.register('country')} />
            </FormField>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />} Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AssignCounselorDialog({
  student,
  open,
  onOpenChange,
}: {
  student: StudentSummary
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const counselors = useCounselors(open)
  const assign = useAssignCounselor()
  const form = useForm<{ staffId: string }>({ defaultValues: { staffId: student.counselorId ?? '' } })
  useEffect(() => {
    if (open) form.reset({ staffId: student.counselorId ?? '' })
  }, [open, student.counselorId, form])

  const submit = form.handleSubmit(async ({ staffId }) => {
    const ok = await assign
      .mutateAsync({ studentId: student.id, staffId: staffId || null })
      .then(() => true)
      .catch(() => false)
    if (ok) onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !assign.isPending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign a counselor</DialogTitle>
          <DialogDescription>
            {student.name} and the counselor are both notified. The counselor can then see only their assigned
            students.
          </DialogDescription>
        </DialogHeader>
        {counselors.isPending ? (
          <CardSkeleton lines={2} />
        ) : counselors.isError ? (
          <ErrorState compact error={counselors.error} onRetry={() => void counselors.refetch()} />
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <FormField label="Counselor">
              <NativeSelect {...form.register('staffId')}>
                <option value="">No counselor</option>
                {counselors.data.map((c) => (
                  <option key={c.staffId} value={c.staffId}>
                    {c.name} ({c.assignedStudents} student{c.assignedStudents === 1 ? '' : 's'})
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            {counselors.data.length === 0 && (
              <p className="text-sm text-muted-foreground">There are no active counselors yet.</p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={assign.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={assign.isPending}>
                {assign.isPending && <Loader2 className="animate-spin" />} Save
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
