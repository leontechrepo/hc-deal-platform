import type { ExtractionCandidate } from '../../api/extractions'

export function cand(over: Partial<ExtractionCandidate>): ExtractionCandidate {
  return {
    id: 'c1',
    run_id: 'r1',
    deal_id: 'd1',
    document_id: 1,
    document_name: 'CIM.pdf',
    field: 'deal_size_m',
    value: 50,
    display_value: '$50.0M',
    confidence: 0.9,
    evidence: 'Facility of $50 million',
    status: 'suggested',
    reason: null,
    current_value: null,
    needs_review: true,
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
    created_at: '2026-01-01T00:00:00Z',
    ...over,
  }
}
