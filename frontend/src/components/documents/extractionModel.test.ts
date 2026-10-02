import { describe, expect, it } from 'vitest'
import {
  apiErrorDetail,
  confidenceBand,
  fieldLabel,
  groupByField,
  reasonCopy,
  reviewCounts,
  reviewErrorCopy,
  runErrorCopy,
} from './extractionModel'

import { cand } from './testFixtures'

describe('confidenceBand', () => {
  it('uses 0.85 / 0.50 thresholds', () => {
    expect(confidenceBand(0.85)).toBe('high')
    expect(confidenceBand(0.84)).toBe('medium')
    expect(confidenceBand(0.5)).toBe('medium')
    expect(confidenceBand(0.49)).toBe('low')
  })
})

describe('fieldLabel', () => {
  it('uses credit terminology and falls back to a humanised name', () => {
    expect(fieldLabel('deal_size_m')).toBe('Facility size ($M)')
    expect(fieldLabel('sofr_floor_pct')).toBe('SOFR floor (%)')
    expect(fieldLabel('some_new_field')).toBe('Some new field')
  })
})

describe('groupByField / reviewCounts', () => {
  const list = [
    cand({ id: 'a', field: 'dscr', status: 'applied', needs_review: false }),
    cand({ id: 'b', field: 'deal_size_m', status: 'conflict', confidence: 0.7 }),
    cand({ id: 'c', field: 'deal_size_m', status: 'conflict', confidence: 0.8, document_id: 2 }),
    cand({ id: 'd', field: 'spread_bps', status: 'suggested' }),
    cand({ id: 'e', field: 'spread_bps', status: 'rejected', needs_review: false }),
    cand({ id: 'f', field: 'fccr', status: 'accepted', needs_review: false }),
  ]

  it('groups by field with conflicts first and splits open from resolved', () => {
    const groups = groupByField(list)
    expect(groups.map((g) => g.field)).toEqual(['deal_size_m', 'spread_bps', 'dscr', 'fccr'])
    expect(groups[0].open.map((c) => c.id)).toEqual(['c', 'b'])
    expect(groups[0].hasConflict).toBe(true)
    expect(groups[1].resolved.map((c) => c.id)).toEqual(['e'])
  })

  it('counts needs-review, applied, conflicting fields and failed runs', () => {
    expect(reviewCounts(list, [{ status: 'error' }, { status: 'complete' }])).toEqual({
      needsReview: 3,
      applied: 2,
      conflicts: 1,
      failed: 1,
    })
  })
})

describe('reasonCopy', () => {
  it('maps known reasons to plain language', () => {
    expect(reasonCopy({ status: 'suggested', reason: 'underwriting_locked' })).toBe(
      'Underwriting fields are locked at this stage.',
    )
    expect(reasonCopy({ status: 'conflict', reason: 'documents disagree on this field' })).toMatch(
      /Documents disagree/,
    )
    expect(reasonCopy({ status: 'differs_from_current', reason: 'field already has a value' })).toMatch(
      /already has a value/,
    )
    expect(reasonCopy({ status: 'suggested', reason: 'confidence below auto-apply threshold' })).toMatch(/85%/)
  })
  it('falls back to status copy', () => {
    expect(reasonCopy({ status: 'matches_existing', reason: null })).toMatch(/Matches/)
    expect(reasonCopy({ status: 'invalid', reason: 'out of range' })).toMatch(/out of range/)
  })
})

describe('error copy', () => {
  it('translates run error codes', () => {
    expect(runErrorCopy('all_documents_failed')).toMatch(/Every document failed/)
    expect(runErrorCopy('weird_code')).toBe('weird_code')
    expect(runErrorCopy(null)).toBeNull()
  })
  it('parses API error detail and flags overwrite 409s', () => {
    const err = Object.assign(new Error('API POST /x → 409: {"detail":"Field already has a value; resubmit with overwrite=true to replace it."}'), { status: 409 })
    expect(apiErrorDetail(err)).toMatch(/already has a value/)
    expect(reviewErrorCopy(err).needsOverwrite).toBe(true)
    const locked = Object.assign(new Error('API POST /x → 409: {"detail":"Underwriting fields are locked"}'), { status: 409 })
    expect(reviewErrorCopy(locked)).toMatchObject({ needsOverwrite: false })
    expect(reviewErrorCopy(locked).message).toMatch(/locked/)
    const bad = Object.assign(new Error('API POST /x → 400: {"detail":"Value no longer valid: out of range"}'), { status: 400 })
    expect(reviewErrorCopy(bad).message).toMatch(/no longer valid \(out of range\)/)
  })
})
