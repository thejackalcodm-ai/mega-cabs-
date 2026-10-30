/**
 * Client-side file validation. The server enforces the same rules (bucket MIME/size limits and
 * table check constraints); this exists to give students immediate, clear feedback.
 */
export type FileKind = 'pdf' | 'jpeg' | 'png' | 'webp' | 'doc' | 'docx' | 'txt'

export const FILE_KINDS: Record<FileKind, { mime: string; extensions: string[]; label: string }> = {
  pdf: { mime: 'application/pdf', extensions: ['pdf'], label: 'PDF' },
  jpeg: { mime: 'image/jpeg', extensions: ['jpg', 'jpeg'], label: 'JPG' },
  png: { mime: 'image/png', extensions: ['png'], label: 'PNG' },
  webp: { mime: 'image/webp', extensions: ['webp'], label: 'WEBP' },
  doc: { mime: 'application/msword', extensions: ['doc'], label: 'DOC' },
  docx: {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['docx'],
    label: 'DOCX',
  },
  txt: { mime: 'text/plain', extensions: ['txt'], label: 'TXT' },
}

export const MB = 1024 * 1024

export const UPLOAD_PRESETS = {
  document: { kinds: ['pdf', 'jpeg', 'png', 'docx'] as FileKind[], maxBytes: 10 * MB },
  image: { kinds: ['jpeg', 'png', 'webp'] as FileKind[], maxBytes: 5 * MB },
  attachment: { kinds: ['pdf', 'jpeg', 'png', 'docx', 'txt'] as FileKind[], maxBytes: 10 * MB },
  submission: { kinds: ['pdf', 'docx', 'txt', 'jpeg', 'png'] as FileKind[], maxBytes: 20 * MB },
} as const

export interface FileRules {
  kinds: readonly FileKind[]
  maxBytes: number
}

export type ValidationResult = { ok: true; kind: FileKind } | { ok: false; message: string }

export function extensionOf(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? ''
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : ''
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < MB) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} MB`
}

export function describeRules(rules: FileRules): string {
  return `${rules.kinds.map((k) => FILE_KINDS[k].label).join(', ')} up to ${formatBytes(rules.maxBytes)}`
}

/** Checks extension AND declared MIME type, and that they agree with each other. */
export function validateFile(
  file: { name: string; type: string; size: number },
  rules: FileRules,
): ValidationResult {
  const ext = extensionOf(file.name)
  const kind = rules.kinds.find((k) => FILE_KINDS[k].extensions.includes(ext))
  if (!kind) return { ok: false, message: `This file type isn't allowed. Use ${describeRules(rules)}.` }
  if (file.type && file.type !== FILE_KINDS[kind].mime) {
    return { ok: false, message: "The file's contents don't match its extension. Please export it again." }
  }
  if (file.size <= 0) return { ok: false, message: 'This file is empty.' }
  if (file.size > rules.maxBytes) {
    return {
      ok: false,
      message: `This file is ${formatBytes(file.size)}. The limit is ${formatBytes(rules.maxBytes)}.`,
    }
  }
  return { ok: true, kind }
}

const SIGNATURES: Partial<Record<FileKind, number[][]>> = {
  pdf: [[0x25, 0x50, 0x44, 0x46]], // %PDF
  png: [[0x89, 0x50, 0x4e, 0x47]],
  jpeg: [[0xff, 0xd8, 0xff]],
  webp: [[0x52, 0x49, 0x46, 0x46]], // RIFF
  docx: [[0x50, 0x4b, 0x03, 0x04]], // zip container
  doc: [[0xd0, 0xcf, 0x11, 0xe0]],
}

/** Verifies the file's leading bytes match its claimed type (catches renamed executables etc.). */
export async function matchesSignature(file: Blob, kind: FileKind): Promise<boolean> {
  const signatures = SIGNATURES[kind]
  if (!signatures) return true
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  return signatures.some((sig) => sig.every((byte, i) => head[i] === byte))
}

/** Produces a storage-safe file name: no paths, ASCII only, limited length, lowercase extension. */
export function sanitizeFileName(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
  const ext = extensionOf(base)
  const stem = (ext ? base.slice(0, -(ext.length + 1)) : base)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80)
  return `${stem || 'file'}${ext ? `.${ext.replace(/[^a-z0-9]/g, '')}` : ''}`
}

/** {studentId}/{category}/{uuid}-{filename} — must match the storage policies. */
export function studentDocumentPath(
  studentId: string,
  category: string,
  fileName: string,
  uuid: string = crypto.randomUUID(),
) {
  return `${studentId}/${category}/${uuid}-${sanitizeFileName(fileName)}`
}
