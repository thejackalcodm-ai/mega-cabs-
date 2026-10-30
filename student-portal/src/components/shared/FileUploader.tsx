import { useId, useRef, useState } from 'react'
import { FileText, Loader2, UploadCloud, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  describeRules,
  FILE_KINDS,
  formatBytes,
  matchesSignature,
  validateFile,
  type FileRules,
} from '@/lib/files'
import { cn } from '@/lib/utils'

interface FileUploaderProps {
  rules: FileRules
  /** Called with a file that passed type, size and content-signature checks. */
  onFileSelected: (file: File) => void
  file?: File | null
  onClear?: () => void
  uploading?: boolean
  progress?: number
  disabled?: boolean
  label?: string
  className?: string
}

export function FileUploader({
  rules,
  onFileSelected,
  file,
  onClear,
  uploading,
  progress,
  disabled,
  label = 'Choose a file or drag it here',
  className,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const hintId = useId()
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const accept = rules.kinds
    .flatMap((k) => [FILE_KINDS[k].mime, ...FILE_KINDS[k].extensions.map((e) => `.${e}`)])
    .join(',')

  async function handle(candidate: File | undefined) {
    if (!candidate) return
    const result = validateFile(candidate, rules)
    if (!result.ok) return setError(result.message)
    if (!(await matchesSignature(candidate, result.kind))) {
      return setError("This file doesn't look like a valid " + FILE_KINDS[result.kind].label + ' file.')
    }
    setError(null)
    onFileSelected(candidate)
  }

  if (file) {
    return (
      <div className={cn('rounded-lg border bg-card p-3', className)}>
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
            <FileText className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
          </div>
          {uploading ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Uploading" />
          ) : (
            onClear && (
              <Button variant="ghost" size="icon" onClick={onClear} aria-label="Remove file">
                <X />
              </Button>
            )
          )}
        </div>
        {uploading && progress !== undefined && <Progress value={progress} className="mt-3 h-1.5" />}
      </div>
    )
  }

  return (
    <div className={className}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void handle(e.dataTransfer.files[0])
        }}
        aria-describedby={hintId}
        className={cn(
          'flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-7 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
          dragging
            ? 'border-primary bg-primary-soft'
            : 'border-input bg-surface hover:border-primary/50 hover:bg-muted/50',
          error && 'border-destructive/60',
        )}
      >
        <UploadCloud className="size-6 text-primary" aria-hidden />
        <span className="text-sm font-medium">{label}</span>
        <span id={hintId} className="text-xs text-muted-foreground">
          {describeRules(rules)}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          void handle(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
