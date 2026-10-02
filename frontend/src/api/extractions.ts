import { apiFetch } from './client'

export type RunStatus = 'pending' | 'processing' | 'complete' | 'error'
export type RunTrigger = 'approval' | 'assignment' | 'manual'

export type CandidateStatus =
  | 'applied'
  | 'suggested'
  | 'conflict'
  | 'differs_from_current'
  | 'matches_existing'
  | 'corroborating'
  | 'superseded'
  | 'invalid'
  | 'accepted'
  | 'rejected'

export interface AppliedField {
  field: string
  value: unknown
  confidence: number
  evidence: string | null
  document_id: number | null
}

export interface ExtractionRunInfo {
  id: string
  deal_id: string
  suggestion_id: number | null
  status: RunStatus
  trigger: RunTrigger
  requested_by: string | null
  document_ids: number[] | null
  retry_count: number
  input_tokens: number | null
  output_tokens: number | null
  estimated_cost_usd: number
  model: string | null
  extracted_fields: Record<string, unknown> | null
  applied_fields: AppliedField[] | null
  applied_field_count: number
  low_confidence_fields: string[] | null
  conflicts: unknown
  document_errors: Record<string, string> | null
  last_error: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string | null
}

export interface ExtractionCandidate {
  id: string
  run_id: string
  deal_id: string
  document_id: number | null
  document_name: string | null
  field: string
  value: unknown
  display_value: string | null
  confidence: number
  evidence: string | null
  status: CandidateStatus
  reason: string | null
  current_value: string | null
  needs_review: boolean
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
  created_at: string | null
}

export interface DealExtractions {
  enabled: boolean
  runs: ExtractionRunInfo[]
  candidates: ExtractionCandidate[]
  pending_review_count: number
}

export function fetchDealExtractions(dealId: string): Promise<DealExtractions> {
  return apiFetch(`/api/deals/${dealId}/extractions`)
}

export function fetchExtractionRun(
  runId: string,
): Promise<ExtractionRunInfo & { candidates: ExtractionCandidate[] }> {
  return apiFetch(`/api/deal-extractions/${runId}`)
}

export function startDealExtraction(dealId: string, documentIds: number[]): Promise<ExtractionRunInfo> {
  return apiFetch(`/api/deals/${dealId}/extractions`, {
    method: 'POST',
    body: JSON.stringify({ document_ids: documentIds }),
  })
}

export function acceptCandidate(
  candidateId: string,
  body: { overwrite?: boolean; note?: string } = {},
): Promise<ExtractionCandidate> {
  return apiFetch(`/api/extraction-candidates/${candidateId}/accept`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function rejectCandidate(
  candidateId: string,
  body: { note?: string } = {},
): Promise<ExtractionCandidate> {
  return apiFetch(`/api/extraction-candidates/${candidateId}/reject`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
