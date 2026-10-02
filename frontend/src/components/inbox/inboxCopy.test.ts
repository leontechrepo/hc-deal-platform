import { describe, expect, it } from 'vitest'
import {
  ATTACHMENTS_DISABLED_COPY,
  CONFIDENCE_HELP,
  FIELD_LABELS,
  apiErrorDetail,
  attachmentStateCopy,
  attachmentTally,
  dispositionCopy,
  fieldLabel,
  formatFieldValue,
  summariseKinds,
} from './inboxCopy'
import { makeSuggestion } from './testFixtures'
import { ApiError } from '../../api/client'

describe('attachmentStateCopy', () => {
  it('has no copy when there are no attachments', () => {
    expect(attachmentStateCopy('none', true)).toBeNull()
  })
  it('explains disabled ingestion explicitly', () => {
    const c = attachmentStateCopy('disabled', false)
    expect(c?.detail).toBe(ATTACHMENTS_DISABLED_COPY)
  })
  it('treats pending as disabled when features say ingestion is off', () => {
    expect(attachmentStateCopy('pending', false)?.detail).toBe(ATTACHMENTS_DISABLED_COPY)
    expect(attachmentStateCopy('pending', true)?.label).toBe('Pending')
    expect(attachmentStateCopy('pending', undefined)?.label).toBe('Pending')
  })
  it('maps failed and ingested', () => {
    expect(attachmentStateCopy('failed', true)).toMatchObject({ label: 'Failed', tone: 'red' })
    expect(attachmentStateCopy('ingested', true)).toMatchObject({ label: 'Ingested', tone: 'green' })
  })
})

describe('dispositionCopy', () => {
  it('describes each disposition with a human reason', () => {
    expect(dispositionCopy({ name: 'a', disposition: 'stored' }).label).toBe('Stored')
    expect(dispositionCopy({ name: 'a', disposition: 'duplicate' }).detail).toMatch(/identical file/)
    expect(dispositionCopy({ name: 'a', disposition: 'skipped', reason: 'message_budget' }).detail).toMatch(/limit/)
    expect(dispositionCopy({ name: 'a', disposition: 'skipped', reason: 'weird_thing' }).detail).toBe('Skipped — weird thing')
    const failed = dispositionCopy({ name: 'a', disposition: 'failed', attempts: 3, reason: 'timeout' })
    expect(failed.detail).toBe('Could not be stored after 3 attempts — timeout')
  })
})

describe('fieldLabel', () => {
  it('uses credit terminology for known fields', () => {
    expect(fieldLabel('deal_size_m')).toBe('Facility size ($M)')
    expect(fieldLabel('spread_bps')).toMatch(/Spread/)
    expect(fieldLabel('dscr')).toMatch(/DSCR/)
  })
  it('covers every whitelisted field and falls back to a humanised name', () => {
    const allowed = [
      'pipeline_stage', 'status', 'next_action', 'nda_status', 'nda_date', 'target_close',
      'deal_size_m', 'hold_amount_m', 'spread_bps', 'total_leverage', 'dscr', 'fccr',
      'interest_coverage', 'ltm_revenue_m', 'ltm_ebitda_m', 'ebitda_margin', 'tenor_months',
      'maturity_date', 'security', 'oid_pct', 'sofr_floor_pct',
    ]
    for (const f of allowed) expect(FIELD_LABELS[f]).toBeTruthy()
    expect(fieldLabel('some_new_field')).toBe('Some new field')
    expect(fieldLabel(null)).toBe('Update')
  })
})

describe('errors and summaries', () => {
  it('extracts the API detail from an error message', () => {
    const lock = new ApiError(409, 'API POST /api/inbox/1/approve → 409: {"detail":"Underwriting fields are locked"}')
    expect(apiErrorDetail(lock)).toBe('Underwriting fields are locked')
  })
  it('summarises kinds', () => {
    expect(
      summariseKinds([
        makeSuggestion({ id: 1 }),
        makeSuggestion({ id: 2 }),
        makeSuggestion({ id: 3, kind: 'new_deal', suggested_field: 'new_deal' }),
      ]),
    ).toBe('2 field updates · 1 new deal')
  })
})

describe('review UX helpers', () => {
  it('formats stage and numeric current values like the proposals', () => {
    expect(formatFieldValue('pipeline_stage', 'pre_loi_diligence')).toBe('Pre-LOI Diligence')
    expect(formatFieldValue('pipeline_stage', 'screening')).toBe('Screening')
    expect(formatFieldValue('deal_size_m', '45')).toBe('45.00M')
    expect(formatFieldValue('spread_bps', '450')).toBe('450 bps')
    expect(formatFieldValue('sofr_floor_pct', '1')).toBe('1%')
    expect(formatFieldValue('security', 'First lien')).toBe('First lien')
    expect(formatFieldValue('dscr', '1.4')).toBe('1.4')
    expect(formatFieldValue('deal_size_m', null)).toBe('')
  })

  it('explains every confidence band', () => {
    for (const band of ['stated', 'inferred', 'weak'] as const) {
      expect(CONFIDENCE_HELP[band].meaning.length).toBeGreaterThan(20)
    }
  })

  it('tallies attachments and counts files still to file', () => {
    const t = attachmentTally(
      [
        { name: 'a', disposition: 'stored' },
        { name: 'b', disposition: 'skipped' },
        { name: 'c', disposition: 'duplicate' },
      ],
      [
        { id: 1, name: 'a', doc_type: null, size_bytes: 1, sha256: 'x', deal_id: null, filed: false, processing_status: null, human_review_required: false, skip_reason: null },
      ],
    )
    expect(t.text).toBe('All processed — 1 stored · 1 duplicate · 1 skipped')
    expect(t.unfiled).toBe(1)
  })
})
