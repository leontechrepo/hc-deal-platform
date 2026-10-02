import { describe, expect, it } from 'vitest'
import { STATED_CONFIDENCE_THRESHOLD, resolveActiveGroup } from '../../components/inbox/inboxCopy'
import { makeGroup, makeSuggestion } from '../../components/inbox/testFixtures'
import {
  filterAndSortGroups,
  groupTopConfidence,
  inboxCounts,
  matchesConfidenceFilter,
} from './inboxFilters'

const groups = [
  makeGroup({
    id: '1',
    has_attachments: true,
    email_subject: 'Alpha',
    email_from: 'a@sponsor.com',
    received_at: '2026-01-02T00:00:00Z',
    suggestions: [makeSuggestion({ id: 1, company_name: 'A', kind: 'new_deal', suggested_field: 'new_deal', confidence: 0.9, requires_attention: true })],
  }),
  makeGroup({
    id: '2',
    email_subject: 'Beta',
    email_from_name: 'Bob',
    received_at: '2026-01-03T00:00:00Z',
    suggestions: [makeSuggestion({ id: 2, company_name: 'B', kind: 'commentary', suggested_field: 'commentary', confidence: 0.7 })],
  }),
  makeGroup({
    id: '3',
    email_subject: 'Gamma',
    received_at: '2026-01-01T00:00:00Z',
    suggestions: [makeSuggestion({ id: 3, company_name: 'Gamma Co', confidence: null })],
  }),
]

const base = { q: '', confidenceFilter: '' as const, attachmentsOnly: false, sort: 'date' as const }

describe('inbox filterAndSortGroups', () => {
  it('filters by attachment and confidence bands', () => {
    expect(
      filterAndSortGroups(groups, { ...base, confidenceFilter: 'stated', attachmentsOnly: true }),
    ).toHaveLength(1)
    expect(matchesConfidenceFilter(0.9, 'stated')).toBe(true)
    expect(matchesConfidenceFilter(0.7, 'stated')).toBe(false)
    expect(matchesConfidenceFilter(0.8, 'inferred')).toBe(true)
    expect(matchesConfidenceFilter(0.7, 'weak')).toBe(true)
    expect(matchesConfidenceFilter(null, 'weak')).toBe(false)
    expect(matchesConfidenceFilter(null, '')).toBe(true)
    expect(groupTopConfidence(groups[0])).toBe(0.9)
    expect(groupTopConfidence(groups[2])).toBeNull()
    expect(STATED_CONFIDENCE_THRESHOLD).toBe(0.85)
  })

  it('sorts by newest date by default and by confidence on request', () => {
    expect(filterAndSortGroups(groups, base).map((g) => g.id)).toEqual(['2', '1', '3'])
    expect(filterAndSortGroups(groups, { ...base, sort: 'confidence' }).map((g) => g.id)).toEqual([
      '1',
      '2',
      '3',
    ])
  })

  it('searches subject, sender, and suggestion company', () => {
    expect(filterAndSortGroups(groups, { ...base, q: 'bob' }).map((g) => g.id)).toEqual(['2'])
    expect(filterAndSortGroups(groups, { ...base, q: 'gamma co' }).map((g) => g.id)).toEqual(['3'])
    expect(filterAndSortGroups(groups, { ...base, q: 'zzz' })).toEqual([])
  })
})

describe('selection + KPI logic', () => {
  it('resolves the active group only while it is still in the queue', () => {
    expect(resolveActiveGroup(groups, null)).toBeNull()
    expect(resolveActiveGroup(groups, '2')?.id).toBe('2')
    expect(resolveActiveGroup(groups, 'gone')).toBeNull()
  })

  it('counts pending emails, new deals, attention, and stated-confidence', () => {
    expect(inboxCounts(groups)).toEqual({
      emails: 3,
      newDeals: 1,
      needsAttention: 1,
      highConfidence: 1,
    })
  })
})
