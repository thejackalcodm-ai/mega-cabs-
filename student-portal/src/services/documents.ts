import { supabase } from '@/lib/supabase'
import { AppError, reportError, unwrap } from '@/lib/errors'
import { FILE_KINDS, matchesSignature, studentDocumentPath, UPLOAD_PRESETS, validateFile } from '@/lib/files'
import type { Enums, Tables } from '@/types/database'

const BUCKET = 'student-documents'
/** Signed URLs are only valid for a minute; they are requested right before use. */
const SIGNED_URL_SECONDS = 60

export type DocumentType = Tables<'document_types'>
export type DocumentRow = Tables<'documents'>
export type DocumentVersion = Tables<'document_versions'>
export type DocumentReview = Tables<'document_reviews'>
export interface StudentDocument extends DocumentRow {
  type: DocumentType | undefined
  versions: DocumentVersion[]
  reviews: (DocumentReview & { reviewerName: string | null })[]
  reviewerName: string | null
}

export async function fetchDocumentTypes(): Promise<DocumentType[]> {
  return unwrap(await supabase.from('document_types').select('*').order('name'), 'documents.types')
}

export async function fetchStudentDocuments(
  studentId: string,
  types: DocumentType[],
): Promise<StudentDocument[]> {
  const docs = unwrap(
    await supabase
      .from('documents')
      .select('*')
      .eq('student_id', studentId)
      .order('uploaded_at', { ascending: false }),
    'documents.list',
  )
  if (docs.length === 0) return []
  const ids = docs.map((d) => d.id)
  const [versions, reviews] = await Promise.all([
    supabase
      .from('document_versions')
      .select('*')
      .in('document_id', ids)
      .order('version', { ascending: false }),
    supabase
      .from('document_reviews')
      .select('*')
      .in('document_id', ids)
      .order('created_at', { ascending: false }),
  ])
  const v = unwrap(versions, 'documents.versions')
  const r = unwrap(reviews, 'documents.reviews')
  // Staff names are readable by students (RLS: staff profiles are visible to signed-in users).
  const reviewerIds = [
    ...new Set(
      [...docs.map((d) => d.reviewer_id), ...r.map((x) => x.reviewer_id)].filter((x): x is string => !!x),
    ),
  ]
  const names = new Map<string, string>()
  if (reviewerIds.length) {
    const people = unwrap(
      await supabase.from('profiles').select('id, first_name, last_name').in('id', reviewerIds),
      'documents.reviewers',
    )
    people.forEach((p) => names.set(p.id, `${p.first_name} ${p.last_name}`.trim()))
  }
  return docs.map((d) => ({
    ...d,
    type: types.find((t) => t.id === d.document_type_id),
    versions: v.filter((x) => x.document_id === d.id),
    reviews: r
      .filter((x) => x.document_id === d.id)
      .map((x) => ({ ...x, reviewerName: names.get(x.reviewer_id) ?? null })),
    reviewerName: d.reviewer_id ? (names.get(d.reviewer_id) ?? null) : null,
  }))
}

/** Same checks as the FileUploader, repeated here so no caller can skip them. */
async function checkFile(file: File) {
  const result = validateFile(file, UPLOAD_PRESETS.document)
  if (!result.ok) throw new AppError(result.message)
  if (!(await matchesSignature(file, result.kind)))
    throw new AppError("This file doesn't look like a valid " + FILE_KINDS[result.kind].label + ' file.')
  return FILE_KINDS[result.kind].mime
}

async function putObject(path: string, file: File, contentType: string) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType, upsert: false, cacheControl: '0' })
  if (error) {
    reportError(error, 'documents.upload')
    throw new AppError(
      /exceeded|too large|413/i.test(error.message)
        ? 'That file is too large.'
        : 'The file could not be uploaded. Please try again.',
    )
  }
}

async function removeObjects(paths: string[]) {
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) reportError(error, 'documents.cleanup') // best effort; unreferenced files stay visible to the owner for clean-up
}

export interface UploadInput {
  studentId: string
  type: DocumentType
  file: File
  customTypeName?: string
  expiryDate?: string | null
}

export async function uploadDocument({
  studentId,
  type,
  file,
  customTypeName,
  expiryDate,
}: UploadInput): Promise<DocumentRow> {
  const mime = await checkFile(file)
  const path = studentDocumentPath(studentId, type.category, file.name)
  await putObject(path, file, mime)
  const { data, error } = await supabase
    .from('documents')
    .insert({
      student_id: studentId,
      document_type_id: type.id,
      category: type.category,
      custom_type_name: type.key === 'other' ? customTypeName?.trim() || null : null,
      file_path: path,
      file_name: path.split('/').pop()!.slice(37), // strip the "{uuid}-" prefix
      file_size: file.size,
      mime_type: mime,
      expiry_date: expiryDate || null,
    })
    .select()
    .single()
  if (error) {
    await removeObjects([path])
    unwrap({ data, error }, 'documents.insert')
  }
  return data!
}

export async function replaceDocument(
  doc: DocumentRow,
  file: File,
  expiryDate?: string | null,
): Promise<DocumentRow> {
  const mime = await checkFile(file)
  const path = studentDocumentPath(doc.student_id, doc.category, file.name)
  await putObject(path, file, mime)
  const { data, error } = await supabase.rpc('replace_document', {
    p_document_id: doc.id,
    p_file_path: path,
    p_file_name: path.split('/').pop()!.slice(37),
    p_file_size: file.size,
    p_mime_type: mime,
    p_expiry_date: expiryDate || undefined,
  })
  if (error) {
    await removeObjects([path])
    unwrap({ data, error }, 'documents.replace')
  }
  return data as DocumentRow
}

export async function deleteDocument(documentId: string) {
  const paths = unwrap(
    await supabase.rpc('delete_document', { p_document_id: documentId }),
    'documents.delete',
  )
  if (paths.length) await removeObjects(paths)
}

export interface DocumentUrl {
  url: string
  fileName: string
  mimeType: string
  version: number
}

/** Audited access: the database records the view/download and opens a short grant, then a 60s URL is signed. */
export async function getDocumentUrl(
  documentId: string,
  purpose: 'view' | 'download',
  version?: number,
): Promise<DocumentUrl> {
  const rows = unwrap(
    await supabase.rpc('authorize_document_access', {
      p_document_id: documentId,
      p_purpose: purpose,
      p_version: version,
    }),
    'documents.authorize',
  )
  const file = rows[0]
  if (!file) throw new AppError("We couldn't find that file.")
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(
      file.file_path,
      SIGNED_URL_SECONDS,
      purpose === 'download' ? { download: file.file_name } : undefined,
    )
  if (error || !data) {
    reportError(error, 'documents.sign')
    throw new AppError("We couldn't open this file. Please try again.")
  }
  return { url: data.signedUrl, fileName: file.file_name, mimeType: file.mime_type, version: file.version }
}

// ---------------------------------------------------------------- checklists

export type ChecklistItem = Tables<'application_checklist'>
export interface ApplicationChecklist {
  applicationId: string
  reference: string
  status: Enums<'application_status'>
  intake: string | null
  university: string
  country: string
  program: string | null
  items: ChecklistItem[]
  completionPercent: number
}

export async function fetchApplicationChecklists(studentId: string): Promise<ApplicationChecklist[]> {
  const apps = unwrap(
    await supabase
      .from('applications')
      .select(
        'id, reference, status, intake, created_at, university:universities(name, country), program:programs(name)',
      )
      .eq('student_id', studentId)
      .not('status', 'in', '(withdrawn,completed,visa_refused)')
      .order('created_at', { ascending: false }),
    'checklists.applications',
  )
  if (apps.length === 0) return []
  const ids = apps.map((a) => a.id)
  const [items, summary] = await Promise.all([
    supabase.from('application_checklist').select('*').in('application_id', ids).order('sort_order'),
    supabase
      .from('application_checklist_summary')
      .select('application_id, completion_percent')
      .in('application_id', ids),
  ])
  const allItems = unwrap(items, 'checklists.items')
  const sums = unwrap(summary, 'checklists.summary')
  return apps.map((a) => ({
    applicationId: a.id,
    reference: a.reference,
    status: a.status,
    intake: a.intake,
    university: a.university?.name ?? 'University',
    country: a.university?.country ?? '',
    program: a.program?.name ?? null,
    items: allItems.filter((i) => i.application_id === a.id),
    completionPercent: Number(sums.find((s) => s.application_id === a.id)?.completion_percent ?? 0),
  }))
}

// ---------------------------------------------------------------- staff review queue

export interface QueueItem {
  id: string
  studentId: string
  studentName: string
  studentNumber: string
  typeName: string
  category: Enums<'document_category'>
  status: Enums<'document_status'>
  fileName: string
  version: number
  uploadedAt: string
  expiryDate: string | null
}

/** Documents awaiting review, oldest first. RLS limits counselors to assigned students. */
export async function fetchReviewQueue(types: DocumentType[]): Promise<QueueItem[]> {
  const rows = unwrap(
    await supabase
      .from('documents')
      .select(
        'id, student_id, document_type_id, custom_type_name, category, status, file_name, version, uploaded_at, expiry_date, student:students(student_number, profile:profiles!students_profile_id_fkey(first_name, last_name))',
      )
      .in('status', ['uploaded', 'under_review'])
      .order('uploaded_at', { ascending: true })
      .limit(500),
    'documents.queue',
  )
  return rows.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    studentName: `${r.student?.profile?.first_name ?? ''} ${r.student?.profile?.last_name ?? ''}`.trim(),
    studentNumber: r.student?.student_number ?? '',
    typeName: r.custom_type_name ?? types.find((t) => t.id === r.document_type_id)?.name ?? 'Document',
    category: r.category,
    status: r.status,
    fileName: r.file_name,
    version: r.version,
    uploadedAt: r.uploaded_at,
    expiryDate: r.expiry_date,
  }))
}
