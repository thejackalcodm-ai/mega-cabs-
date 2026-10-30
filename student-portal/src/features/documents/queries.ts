import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/shared/toast'
import {
  deleteDocument,
  fetchApplicationChecklists,
  fetchDocumentTypes,
  fetchStudentDocuments,
  getDocumentUrl,
  replaceDocument,
  uploadDocument,
  type DocumentRow,
  type UploadInput,
} from '@/services/documents'

export const documentKeys = {
  types: ['document-types'] as const,
  list: (studentId: string) => ['documents', studentId] as const,
  checklists: (studentId: string) => ['checklists', studentId] as const,
  queue: ['documents', 'queue'] as const,
}

export function useDocumentTypes() {
  return useQuery({ queryKey: documentKeys.types, queryFn: fetchDocumentTypes, staleTime: 60 * 60_000 })
}

export function useStudentDocuments(studentId: string) {
  const types = useDocumentTypes()
  const docs = useQuery({
    queryKey: documentKeys.list(studentId),
    queryFn: () => fetchStudentDocuments(studentId, types.data!),
    enabled: !!types.data,
  })
  return {
    ...docs,
    isPending: types.isPending || docs.isPending,
    error: types.error ?? docs.error,
    isError: types.isError || docs.isError,
    refetch: () => (types.isError ? types.refetch() : docs.refetch()),
  }
}

export function useChecklists(studentId: string) {
  return useQuery({
    queryKey: documentKeys.checklists(studentId),
    queryFn: () => fetchApplicationChecklists(studentId),
  })
}

function useInvalidateDocuments(studentId: string) {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: documentKeys.list(studentId) }),
      qc.invalidateQueries({ queryKey: documentKeys.checklists(studentId) }),
      qc.invalidateQueries({ queryKey: documentKeys.queue }),
      qc.invalidateQueries({ queryKey: ['profile-completion'] }),
    ])
}

export function useUploadDocument(studentId: string) {
  const invalidate = useInvalidateDocuments(studentId)
  return useMutation({
    mutationFn: (input: Omit<UploadInput, 'studentId'>) => uploadDocument({ ...input, studentId }),
    onSuccess: async () => {
      await invalidate()
      toast.success('Document uploaded', 'Your counselor will review it soon.')
    },
    onError: (e) => toast.error(e, 'Upload failed'),
  })
}

export function useReplaceDocument(studentId: string) {
  const invalidate = useInvalidateDocuments(studentId)
  return useMutation({
    mutationFn: ({ doc, file, expiryDate }: { doc: DocumentRow; file: File; expiryDate?: string | null }) =>
      replaceDocument(doc, file, expiryDate),
    onSuccess: async (d) => {
      await invalidate()
      toast.success(`Version ${d.version} uploaded`, 'The previous version is kept in the history.')
    },
    onError: (e) => toast.error(e, 'Replacement failed'),
  })
}

export function useDeleteDocument(studentId: string) {
  const invalidate = useInvalidateDocuments(studentId)
  return useMutation({
    mutationFn: deleteDocument,
    onSuccess: async () => {
      await invalidate()
      toast.success('Document deleted')
    },
    onError: (e) => toast.error(e, "Couldn't delete the document"),
  })
}

/** Downloads via an audited, 60-second signed URL. */
export async function downloadDocument(documentId: string, version?: number) {
  try {
    const { url } = await getDocumentUrl(documentId, 'download', version)
    const a = document.createElement('a')
    a.href = url
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } catch (e) {
    toast.error(e, "Couldn't download the file")
  }
}
