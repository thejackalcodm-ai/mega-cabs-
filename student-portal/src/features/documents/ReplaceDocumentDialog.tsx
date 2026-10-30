import { useEffect, useState } from 'react'
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
import { FileUploader } from '@/components/shared/FileUploader'
import { FormField } from '@/components/shared/FormField'
import { useReplaceDocument } from '@/features/documents/queries'
import { UPLOAD_PRESETS } from '@/lib/files'
import type { StudentDocument } from '@/services/documents'

export function ReplaceDocumentDialog({
  doc,
  onClose,
}: {
  doc: StudentDocument | null
  onClose: () => void
}) {
  const replace = useReplaceDocument(doc?.student_id ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [expiry, setExpiry] = useState('')
  useEffect(() => {
    setFile(null)
    setExpiry('')
  }, [doc?.id])
  const name = doc ? (doc.custom_type_name ?? doc.type?.name ?? 'Document') : ''

  async function submit() {
    if (!doc || !file) return
    await replace
      .mutateAsync({ doc, file, expiryDate: expiry || null })
      .then(onClose)
      .catch(() => undefined)
  }

  return (
    <Dialog open={!!doc} onOpenChange={(o) => !o && !replace.isPending && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Replace {name}</DialogTitle>
          <DialogDescription>
            This uploads version {doc ? doc.version + 1 : ''} and sends it for review. Earlier versions stay
            in the history.
          </DialogDescription>
        </DialogHeader>
        {doc?.required_action && (
          <p className="rounded-md border border-status-warning/30 bg-status-warning-soft px-3 py-2 text-sm text-status-warning">
            <strong>What to fix:</strong> {doc.required_action}
          </p>
        )}
        <FileUploader
          rules={UPLOAD_PRESETS.document}
          file={file}
          onFileSelected={setFile}
          onClear={() => setFile(null)}
          uploading={replace.isPending}
          disabled={replace.isPending}
          label="Choose the new file"
        />
        {doc?.type?.has_expiry && (
          <FormField label="New expiry date" hint="Leave blank to keep the current date">
            <Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </FormField>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={replace.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!file || replace.isPending}>
            {replace.isPending && <Loader2 className="animate-spin" />}
            Upload new version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
