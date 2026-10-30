import { describe, expect, it } from 'vitest'
import {
  matchesSignature,
  sanitizeFileName,
  studentDocumentPath,
  UPLOAD_PRESETS,
  validateFile,
} from '@/lib/files'

const doc = UPLOAD_PRESETS.document

describe('validateFile', () => {
  it('accepts a PDF within the limit', () => {
    expect(validateFile({ name: 'passport.PDF', type: 'application/pdf', size: 2048 }, doc)).toEqual({
      ok: true,
      kind: 'pdf',
    })
  })
  it('rejects disallowed extensions', () => {
    const r = validateFile({ name: 'run.exe', type: 'application/x-msdownload', size: 10 }, doc)
    expect(r.ok).toBe(false)
  })
  it('rejects a MIME type that contradicts the extension', () => {
    const r = validateFile({ name: 'photo.pdf', type: 'image/png', size: 10 }, doc)
    expect(r).toMatchObject({ ok: false })
  })
  it('rejects empty and oversize files', () => {
    expect(validateFile({ name: 'a.pdf', type: 'application/pdf', size: 0 }, doc).ok).toBe(false)
    const big = validateFile({ name: 'a.pdf', type: 'application/pdf', size: 10 * 1024 * 1024 + 1 }, doc)
    expect(big).toMatchObject({ ok: false, message: expect.stringContaining('10 MB') })
  })
  it('accepts files whose browser MIME type is empty when the extension is allowed', () => {
    expect(validateFile({ name: 'scan.jpeg', type: '', size: 5 }, doc)).toEqual({ ok: true, kind: 'jpeg' })
  })
})

describe('matchesSignature', () => {
  it('detects real PDFs and renamed files', async () => {
    expect(await matchesSignature(new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])]), 'pdf')).toBe(
      true,
    )
    expect(await matchesSignature(new Blob([new Uint8Array([0x4d, 0x5a, 0x90, 0x00])]), 'pdf')).toBe(false)
    expect(await matchesSignature(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])]), 'jpeg')).toBe(true)
  })
})

describe('sanitizeFileName', () => {
  it.each([
    ['../../etc/passwd', 'passwd'],
    ['C:\\Users\\me\\Bank Statement (Oct).PDF', 'Bank-Statement-Oct.pdf'],
    ['Résumé final.docx', 'Resume-final.docx'],
    ['   .pdf', 'file.pdf'],
    ['护照.png', 'file.png'],
    ['a'.repeat(200) + '.pdf', 'a'.repeat(80) + '.pdf'],
  ])('%s -> %s', (input, expected) => {
    expect(sanitizeFileName(input)).toBe(expected)
  })
})

describe('studentDocumentPath', () => {
  it('follows {student_id}/{category}/{uuid}-{filename}', () => {
    expect(studentDocumentPath('stu-1', 'financial', 'My Bank.pdf', 'u-1')).toBe(
      'stu-1/financial/u-1-My-Bank.pdf',
    )
  })
})
