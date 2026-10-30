import { describe, expect, it } from 'vitest'
import {
  canStudentDelete,
  canStudentReplace,
  checklistBreakdown,
  effectiveStatus,
  expiryState,
  needsAction,
} from '@/lib/documents'

const today = new Date('2026-10-30T12:00:00Z')

describe('document rules', () => {
  it('treats a past expiry date as expired regardless of stored status', () => {
    expect(effectiveStatus('approved', '2026-10-29', today)).toBe('expired')
    expect(effectiveStatus('approved', '2026-10-30', today)).toBe('approved')
    expect(effectiveStatus('under_review', null, today)).toBe('under_review')
  })
  it('matches the database delete / replace rules', () => {
    expect(canStudentDelete('uploaded')).toBe(true)
    expect(canStudentDelete('rejected')).toBe(true)
    expect(canStudentDelete('approved')).toBe(false)
    expect(canStudentDelete('under_review')).toBe(false)
    expect(canStudentReplace('approved')).toBe(false)
    expect(canStudentReplace('resubmission_required')).toBe(true)
  })
  it('flags documents that need the student to act', () => {
    expect(['rejected', 'resubmission_required', 'expired'].every((s) => needsAction(s as never))).toBe(true)
    expect(needsAction('approved')).toBe(false)
  })
  it('classifies expiry', () => {
    expect(expiryState(null, today)).toEqual({ kind: 'none' })
    expect(expiryState('2026-11-15', today)).toEqual({ kind: 'soon', days: 16 })
    expect(expiryState('2027-06-01', today).kind).toBe('ok')
    expect(expiryState('2026-10-01', today)).toEqual({ kind: 'expired', days: -29 })
  })
})

describe('checklistBreakdown', () => {
  it('counts required, completed, missing, rejected and expired items', () => {
    const items = [
      { is_required: true, item_state: 'complete' },
      { is_required: true, item_state: 'complete' },
      { is_required: true, item_state: 'missing' },
      { is_required: true, item_state: 'rejected' },
      { is_required: true, item_state: 'expired' },
      { is_required: true, item_state: 'pending' },
      { is_required: false, item_state: 'missing' },
    ]
    expect(checklistBreakdown(items)).toEqual({
      required: 6,
      completed: 2,
      pending: 1,
      missing: 1,
      rejected: 1,
      expired: 1,
    })
  })
})
