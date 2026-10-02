import { describe, expect, it } from 'vitest'
import { ApiError } from '../../api/client'
import { makeGroup, makeSuggestion } from './testFixtures'
import {
  blockingReason,
  buildAcceptBody,
  initialReviewState,
  isLowConfidence,
  lowestConfidence,
  newDealDraft,
  parseAcceptError,
  splitSuggestions,
} from './reviewState'

const update = (id: number, over = {}) => makeSuggestion({ id, ...over })
const newDeal = makeSuggestion({
  id: 9,
  kind: 'new_deal',
  suggested_field: 'new_deal',
  deal_id: null,
  company_name: 'Acme Dental',
  estimated_size_m: 40,
  estimated_sector: 'Dental',
  claude_summary: 'Intro from sponsor',
  payload: { company_name: 'Acme Dental', sector: 'Dental Services', summary: 'Intro from sponsor' },
})

describe('confidence flags', () => {
  it('flags only weak values and reports the lowest band once', () => {
    expect(isLowConfidence(update(1, { confidence: 0.6 }))).toBe(true)
    expect(isLowConfidence(update(2, { confidence: 0.8 }))).toBe(false)
    expect(isLowConfidence(update(3, { confidence: null }))).toBe(false)
    expect(lowestConfidence([update(1, { confidence: 0.9 }), update(2, { confidence: 0.6 })])).toBe(0.6)
    expect(lowestConfidence([])).toBeNull()
  })
})

describe('new deal draft', () => {
  it('pre-fills the form from the payload and estimates', () => {
    expect(newDealDraft(newDeal)).toEqual({
      company_name: 'Acme Dental',
      sector: 'Dental Services',
      deal_size_m: '40',
      summary: 'Intro from sponsor',
    })
  })
  it('falls back to the JSON mirror in suggested_value', () => {
    const s = makeSuggestion({
      id: 1, kind: 'new_deal', suggested_field: 'new_deal', payload: null,
      suggested_value: JSON.stringify({ company_name: 'Json Co', sector: 'Labs' }),
    })
    expect(newDealDraft(s)).toMatchObject({ company_name: 'Json Co', sector: 'Labs' })
  })
})

describe('building the accept request', () => {
  it('sends edited values, unticked fields, and the chosen deal', () => {
    const group = makeGroup({ id: '5', deal_id: 'deal-1', suggestions: [update(1), update(2, { suggested_field: 'spread_bps', suggested_value: '450' })] })
    const parts = splitSuggestions(group)
    const state = initialReviewState(group)
    state.values[1] = '72.5'
    state.included[2] = false
    expect(buildAcceptBody(parts, state)).toEqual({
      deal_id: 'deal-1',
      fields: [
        { suggestion_id: 1, value: '72.5', include: true },
        { suggestion_id: 2, value: '450', include: false },
      ],
    })
  })

  it('sends the edited new-deal form, or a link, but never both', () => {
    const group = makeGroup({ id: '6', suggestions: [newDeal] })
    const parts = splitSuggestions(group)
    const state = initialReviewState(group)
    state.newDeal.company_name = '  Acme Dental Partners '
    state.newDeal.deal_size_m = ''
    const body = buildAcceptBody(parts, state)
    expect(body.new_deal).toEqual({
      company_name: 'Acme Dental Partners',
      sector: 'Dental Services',
      deal_size_m: null,
      summary: 'Intro from sponsor',
    })
    expect(body.deal_id).toBeUndefined()

    const linked = { ...state, linkMode: true, linkedDealId: 'deal-7' }
    const linkBody = buildAcceptBody(parts, linked)
    expect(linkBody.deal_id).toBe('deal-7')
    expect(linkBody.new_deal).toBeUndefined()
  })
})

describe('blocking reasons', () => {
  it('explains why the primary action is unavailable', () => {
    const noDeal = makeGroup({ id: '1', deal_id: null, suggestions: [update(1, { deal_id: null })] })
    expect(blockingReason(splitSuggestions(noDeal), initialReviewState(noDeal))).toMatch(/Pick the deal/)

    const ok = makeGroup({ id: '2', deal_id: 'd', suggestions: [update(1)] })
    const state = initialReviewState(ok)
    expect(blockingReason(splitSuggestions(ok), state)).toBeNull()
    state.included[1] = false
    expect(blockingReason(splitSuggestions(ok), state)).toMatch(/at least one/)

    const nd = makeGroup({ id: '3', suggestions: [newDeal] })
    const ndState = initialReviewState(nd)
    ndState.newDeal.company_name = ' '
    expect(blockingReason(splitSuggestions(nd), ndState)).toMatch(/company name/)
  })
})

describe('accept errors', () => {
  it('maps a 422 to per-field messages and detects a needed reason', () => {
    const err = new ApiError(
      422,
      'API POST /x → 422: ' + JSON.stringify({
        detail: {
          message: 'Some values could not be applied',
          errors: [
            { suggestion_id: 1, field: 'dscr', status: 400, message: 'Invalid value for dscr: nope' },
            { suggestion_id: 2, field: 'pipeline_stage', status: 400, message: "Cannot skip pipeline stages from 'a' to 'b'" },
          ],
        },
      }),
    )
    const f = parseAcceptError(err)
    expect(f.rows[1]).toEqual({ status: 400, message: 'Invalid value for dscr: nope' })
    expect(f.needsReasoning).toBe('stage_skip')
    expect(f.general).toBeNull()
  })
  it('keeps other failures as one general message', () => {
    const f = parseAcceptError(new ApiError(404, 'API POST /x → 404: {"detail":"Inbox item not found or already reviewed"}'))
    expect(f.general).toBe('Inbox item not found or already reviewed')
    expect(f.rows).toEqual({})
  })
})
