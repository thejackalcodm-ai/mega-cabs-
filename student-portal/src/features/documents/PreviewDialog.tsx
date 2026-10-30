import { useQuery } from '@tanstack/react-query'
import { Download, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { downloadDocument } from '@/features/documents/queries'
import { getDocumentUrl } from '@/services/documents'

interface PreviewTarget {
  documentId: string
  title: string
  version?: number
}

/** Shows a document through a fresh audited signed URL (never cached: each open is a new grant). */
export function PreviewDialog({ target, onClose }: { target: PreviewTarget | null; onClose: () => void }) {
  const file = useQuery({
    queryKey: ['document-preview', target?.documentId, target?.version],
    queryFn: () => getDocumentUrl(target!.documentId, 'view', target!.version),
    enabled: !!target,
    gcTime: 0,
    staleTime: 0,
    retry: false,
  })
  const isImage = file.data?.mimeType.startsWith('image/')
  const isPdf = file.data?.mimeType === 'application/pdf'

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[90dvh] max-w-4xl flex-col gap-3 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="truncate">{target?.title}</DialogTitle>
          <DialogDescription className="truncate">
            {file.data
              ? `${file.data.fileName} · version ${file.data.version}`
              : 'Preparing a secure preview…'}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden rounded-md border bg-muted/40">
          {file.isPending ? (
            <Skeleton className="h-full w-full rounded-none" />
          ) : file.isError ? (
            <ErrorState error={file.error} title="Preview unavailable" onRetry={() => void file.refetch()} />
          ) : isPdf ? (
            <iframe
              title={`Preview of ${file.data.fileName}`}
              src={file.data.url}
              className="h-full w-full bg-white"
            />
          ) : isImage ? (
            <img
              src={file.data.url}
              alt={`Preview of ${file.data.fileName}`}
              className="h-full w-full object-contain"
            />
          ) : (
            <EmptyState
              icon={FileText}
              title="No preview for this file type"
              description="Download the file to open it."
            />
          )}
        </div>
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => target && void downloadDocument(target.documentId, target.version)}
            disabled={!file.data}
          >
            <Download /> Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
