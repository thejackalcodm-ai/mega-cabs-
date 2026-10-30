import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { FileUploader } from '@/components/shared/FileUploader'
import { FormField } from '@/components/shared/FormField'
import { useDocumentTypes, useUploadDocument } from '@/features/documents/queries'
import { DOCUMENT_CATEGORY_LABEL } from '@/lib/constants'
import { UPLOAD_PRESETS } from '@/lib/files'
import type { Enums } from '@/types/database'

type Category = Enums<'document_category'>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentId: string
  /** Pre-select a document type (e.g. from a checklist item). */
  presetTypeId?: string
}

export function UploadDocumentDialog({ open, onOpenChange, studentId, presetTypeId }: Props) {
  const types = useDocumentTypes()
  const upload = useUploadDocument(studentId)
  const [category, setCategory] = useState<Category | ''>('')
  const [typeId, setTypeId] = useState('')
  const [customName, setCustomName] = useState('')
  const [expiry, setExpiry] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    const preset = types.data?.find((t) => t.id === presetTypeId)
    setCategory(preset?.category ?? '')
    setTypeId(preset?.id ?? '')
    setCustomName('')
    setExpiry('')
    setFile(null)
    setTouched(false)
  }, [open, presetTypeId, types.data])

  const options = useMemo(
    () => (types.data ?? []).filter((t) => t.category === category && !t.is_custom),
    [types.data, category],
  )
  const type = types.data?.find((t) => t.id === typeId)
  const errors = {
    category: !category ? 'Choose a category' : undefined,
    type: !type ? 'Choose a document type' : undefined,
    custom: type?.key === 'other' && customName.trim().length < 2 ? 'Name this document' : undefined,
    expiry:
      expiry && expiry < new Date().toISOString().slice(0, 10)
        ? 'This document has already expired'
        : undefined,
    file: !file ? 'Choose a file' : undefined,
  }
  const valid = !Object.values(errors).some(Boolean)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!valid || !type || !file) return
    await upload
      .mutateAsync({ type, file, customTypeName: customName, expiryDate: expiry || null })
      .then(() => onOpenChange(false))
      .catch(() => undefined)
  }
  const show = (k: keyof typeof errors) => (touched ? errors[k] : undefined)

  return (
    <Dialog open={open} onOpenChange={(o) => !upload.isPending && onOpenChange(o)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload a document</DialogTitle>
          <DialogDescription>
            Stored privately. Only you, your counselor and authorised staff can open it.
          </DialogDescription>
        </DialogHeader>
        <form id="upload-document" onSubmit={submit} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Category" required error={show('category')}>
              <NativeSelect
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as Category)
                  setTypeId('')
                }}
                disabled={types.isPending}
              >
                <option value="" disabled>
                  {types.isPending ? 'Loading…' : 'Select…'}
                </option>
                {(Object.keys(DOCUMENT_CATEGORY_LABEL) as Category[]).map((c) => (
                  <option key={c} value={c}>
                    {DOCUMENT_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Document type" required error={show('type')}>
              <NativeSelect value={typeId} onChange={(e) => setTypeId(e.target.value)} disabled={!category}>
                <option value="" disabled>
                  Select…
                </option>
                {options.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            {type?.key === 'other' && (
              <FormField label="Document name" required error={show('custom')} className="sm:col-span-2">
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  maxLength={80}
                  placeholder="e.g. Scholarship award letter"
                />
              </FormField>
            )}
            {type?.has_expiry && (
              <FormField label="Expiry date" error={show('expiry')} hint="We'll remind you before it expires">
                <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
              </FormField>
            )}
          </div>
          <div>
            <FileUploader
              rules={UPLOAD_PRESETS.document}
              file={file}
              onFileSelected={setFile}
              onClear={() => setFile(null)}
              uploading={upload.isPending}
              disabled={upload.isPending}
            />
            {show('file') && !file && <p className="mt-2 text-sm text-destructive">{errors.file}</p>}
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={upload.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="upload-document" disabled={upload.isPending}>
            {upload.isPending && <Loader2 className="animate-spin" />}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
