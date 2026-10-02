import type {
  CandidateStatus,
  ExtractionCandidate,
  ExtractionRunInfo,
} from '../../api/extractions'
import type { FeaturesInfo } from '../../api/meta'

/** Credit terminology for the extractable deal fields. */
export const FIELD_LABELS: Record<string, string> = {
  deal_size_m: 'Facility size ($M)',
  hold_amount_m: 'Hold amount ($M)',
  spread_bps: 'Spread (bps)',
  total_leverage: 'Total leverage (x)',
  dscr: 'DSCR (x)',
  fccr: 'FCCR (x)',
  interest_coverage: 'Interest coverage (x)',
  ltm_revenue_m: 'LTM revenue ($M)',
  ltm_ebitda_m: 'LTM EBITDA ($M)',
  ebitda_margin: 'EBITDA margin (%)',
  tenor_months: 'Tenor (months)',
  maturity_date: 'Maturity date',
  security: 'Security / collateral',
  oid_pct: 'OID (%)',
  sofr_floor_pct: 'SOFR floor (%)',
  nda_date: 'NDA date',
  target_close: 'Target close',
}

export function fieldLabel(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field]
  const words = field.replace(/_/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export const HIGH_CONFIDENCE = 0.85
export const LOW_CONFIDENCE = 0.5

export type ConfidenceBand = 'high' | 'medium' | 'low'

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= HIGH_CONFIDENCE) return 'high'
  if (confidence < LOW_CONFIDENCE) return 'low'
  return 'medium'
}

export function pct(confidence: number): string {
  return `${Math.round(confidence * 100)}%`
}

const NEEDS_REVIEW: ReadonlySet<CandidateStatus> = new Set([
  'suggested',
  'conflict',
  'differs_from_current',
])

export function needsReview(c: Pick<ExtractionCandidate, 'status' | 'needs_review'>): boolean {
  return c.needs_review ?? NEEDS_REVIEW.has(c.status)
}

export interface FieldGroup {
  field: string
  label: string
  open: ExtractionCandidate[]
  resolved: ExtractionCandidate[]
  hasConflict: boolean
}

/** Group candidates by field; open (needs review) first, conflicts first among them. */
export function groupByField(candidates: ExtractionCandidate[]): FieldGroup[] {
  const map = new Map<string, FieldGroup>()
  for (const c of candidates) {
    let g = map.get(c.field)
    if (!g) {
      g = { field: c.field, label: fieldLabel(c.field), open: [], resolved: [], hasConflict: false }
      map.set(c.field, g)
    }
    if (needsReview(c)) {
      g.open.push(c)
      if (c.status === 'conflict') g.hasConflict = true
    } else {
      g.resolved.push(c)
    }
  }
  const groups = [...map.values()]
  for (const g of groups) {
    g.open.sort((a, b) => b.confidence - a.confidence)
    g.resolved.sort((a, b) => (b.reviewed_at ?? b.created_at ?? '').localeCompare(a.reviewed_at ?? a.created_at ?? ''))
  }
  return groups.sort((a, b) => {
    const rank = (g: FieldGroup) => (g.hasConflict ? 0 : g.open.length > 0 ? 1 : 2)
    return rank(a) - rank(b) || a.label.localeCompare(b.label)
  })
}

export interface ReviewCounts {
  needsReview: number
  applied: number
  conflicts: number
  failed: number
}

/** `conflicts` counts fields with an unresolved conflict; `failed` counts errored runs. */
export function reviewCounts(
  candidates: ExtractionCandidate[],
  runs: Pick<ExtractionRunInfo, 'status'>[],
): ReviewCounts {
  const conflictFields = new Set<string>()
  let open = 0
  let applied = 0
  for (const c of candidates) {
    if (needsReview(c)) {
      open += 1
      if (c.status === 'conflict') conflictFields.add(c.field)
    } else if (c.status === 'applied' || c.status === 'accepted') {
      applied += 1
    }
  }
  return {
    needsReview: open,
    applied,
    conflicts: conflictFields.size,
    failed: runs.filter((r) => r.status === 'error').length,
  }
}

export function isRunActive(run: Pick<ExtractionRunInfo, 'status'>): boolean {
  return run.status === 'pending' || run.status === 'processing'
}

/** Plain-language explanation of why a candidate has its status. */
export function reasonCopy(c: Pick<ExtractionCandidate, 'status' | 'reason'>): string {
  const reason = c.reason ?? ''
  if (reason === 'underwriting_locked') return 'Underwriting fields are locked at this stage.'
  if (reason === 'documents disagree on this field') {
    return 'Documents disagree on this field. Pick the value to keep.'
  }
  if (reason === 'field already has a value') {
    return 'This field already has a value on the deal.'
  }
  if (reason === 'confidence below auto-apply threshold') {
    return `Confidence is below the auto-apply threshold (${pct(HIGH_CONFIDENCE)}).`
  }
  if (reason === 'weaker than the winning value') return 'A stronger value from another document won.'
  if (reason.startsWith('resolved by reviewer')) return 'Settled when a reviewer resolved this field.'
  if (c.status === 'invalid') {
    return reason ? `Value failed validation: ${reason}.` : 'Value failed validation.'
  }
  switch (c.status) {
    case 'applied':
      return 'Applied automatically (high confidence, field was empty).'
    case 'matches_existing':
      return 'Matches the value already on the deal.'
    case 'corroborating':
      return 'Agrees with the value that was kept.'
    case 'superseded':
      return 'A stronger value was kept instead.'
    case 'accepted':
      return 'Accepted by a reviewer.'
    case 'rejected':
      return 'Rejected by a reviewer.'
    case 'conflict':
      return 'Documents disagree on this field.'
    case 'differs_from_current':
      return 'Differs from the value already on the deal.'
    case 'suggested':
      return 'Suggested value awaiting review.'
  }
  return reason
}

export const STATUS_LABELS: Record<CandidateStatus, string> = {
  applied: 'Auto-applied',
  suggested: 'Suggested',
  conflict: 'Conflict',
  differs_from_current: 'Differs from current',
  matches_existing: 'Matches existing',
  corroborating: 'Corroborating',
  superseded: 'Superseded',
  invalid: 'Invalid',
  accepted: 'Accepted',
  rejected: 'Rejected',
}

export type Tone = 'navy' | 'gold' | 'green' | 'red' | 'amber' | 'blue' | 'gray'

export function statusTone(status: CandidateStatus): Tone {
  switch (status) {
    case 'applied':
    case 'accepted':
      return 'green'
    case 'conflict':
    case 'invalid':
    case 'rejected':
      return 'red'
    case 'suggested':
    case 'differs_from_current':
      return 'amber'
    default:
      return 'gray'
  }
}

export function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === ''
}

export function formatValue(value: unknown): string {
  return isBlank(value) ? '—' : String(value)
}

export function candidateValue(c: Pick<ExtractionCandidate, 'display_value' | 'value'>): string {
  return formatValue(c.display_value ?? c.value)
}

const RUN_ERRORS: Record<string, string> = {
  source_not_found: 'The deal or source record could not be found.',
  no_extractable_documents: 'No extractable documents were found for this run.',
  waiting_for_documents: 'Waiting for documents to finish filing.',
  document_failures_retrying: 'Some documents failed; retrying automatically.',
  all_documents_failed: 'Every document failed to process.',
  partial_document_failure: 'Some documents failed to process; the rest were extracted.',
  worker_interrupted: 'The worker was interrupted; the run will be retried.',
  worker_crashed: 'The worker crashed while processing this run.',
}

export function runErrorCopy(code: string | null | undefined): string | null {
  if (!code) return null
  return RUN_ERRORS[code] ?? code
}

export const TRIGGER_LABELS: Record<string, string> = {
  approval: 'On approval',
  assignment: 'On assignment',
  manual: 'Manual',
}

export function runStatusLabel(run: Pick<ExtractionRunInfo, 'status' | 'retry_count' | 'last_error'>): string {
  if (run.status === 'processing') return 'Processing'
  if (run.status === 'pending') {
    return run.retry_count > 0 || run.last_error === 'document_failures_retrying'
      ? 'Retrying'
      : 'Queued'
  }
  if (run.status === 'error') return 'Failed'
  return run.last_error === 'partial_document_failure' ? 'Complete (partial)' : 'Complete'
}

/** Pull the `detail` string out of an ApiError message (`API POST /x → 409: {"detail":"…"}`). */
export function apiErrorDetail(err: unknown): string | null {
  const message = err instanceof Error ? err.message : ''
  const start = message.indexOf('{')
  if (start >= 0) {
    try {
      const parsed = JSON.parse(message.slice(start)) as { detail?: unknown }
      if (typeof parsed.detail === 'string') return parsed.detail
    } catch {
      /* fall through */
    }
  }
  return null
}

export type ReviewActionError = { message: string; needsOverwrite: boolean }

/** Friendly text for accept/reject failures. */
export function reviewErrorCopy(err: unknown): ReviewActionError {
  const status = (err as { status?: number } | null)?.status
  const detail = apiErrorDetail(err)
  if (status === 409 && detail && /already has a value/i.test(detail)) {
    return {
      message: 'This field already has a value. Confirm to replace it.',
      needsOverwrite: true,
    }
  }
  if (status === 409 && detail && /locked/i.test(detail)) {
    return { message: 'Underwriting fields are locked at this stage, so this value cannot be applied.', needsOverwrite: false }
  }
  if (status === 409 && detail && /already resolved/i.test(detail)) {
    return { message: 'Someone already resolved this candidate. The list has been refreshed.', needsOverwrite: false }
  }
  if (status === 400) {
    return {
      message: `The extracted value is no longer valid${detail ? ` (${detail.replace(/^Value no longer valid:\s*/i, '')})` : ''}.`,
      needsOverwrite: false,
    }
  }
  if (status === 404) return { message: 'This candidate no longer exists.', needsOverwrite: false }
  return { message: detail ?? 'Something went wrong. Please try again.', needsOverwrite: false }
}

export type ExtractionAvailability =
  | { state: 'unknown'; title: string; detail: string }
  | { state: 'on' }
  | { state: 'off'; title: string; detail: string }
  | { state: 'needs_ingestion'; title: string; detail: string }

/** What the UI may claim about extraction, derived only from the features endpoint. */
export function extractionAvailability(features: FeaturesInfo | undefined): ExtractionAvailability {
  if (!features) {
    return {
      state: 'unknown',
      title: 'Checking extraction availability',
      detail: 'Extraction controls are disabled until the server reports its capabilities.',
    }
  }
  if (features.document_extraction_enabled) return { state: 'on' }
  if (features.document_extraction_requires_ingestion || (features.document_extraction_flag && !features.attachment_ingestion_enabled)) {
    return {
      state: 'needs_ingestion',
      title: 'Extraction is enabled but needs attachment ingestion',
      detail:
        'Document extraction is switched on, but attachment ingestion is off, so nothing can run. Enable attachment ingestion on the server. Existing results stay visible below.',
    }
  }
  return {
    state: 'off',
    title: 'Extraction is off',
    detail:
      'Document extraction is disabled on the server, so new documents are not analysed. Existing results stay visible below.',
  }
}

/** Exact reason the run control is disabled, or null when it is usable. */
export function runDisabledReason(
  features: FeaturesInfo | undefined,
  selectedCount: number,
  maxDocs = 10,
): string | null {
  const a = extractionAvailability(features)
  if (a.state !== 'on') return a.title
  if (selectedCount === 0) return 'Select at least one document to extract.'
  if (selectedCount > maxDocs) return `Select at most ${maxDocs} documents per run.`
  return null
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const SKIP_REASONS: Record<string, string> = {
  unsupported_type: 'Unsupported file type',
  too_large: 'File too large',
  inline_image: 'Inline image (signature/logo)',
  duplicate: 'Duplicate of another file',
}

export function skipReasonCopy(reason: string | null | undefined): string | null {
  if (!reason) return null
  return SKIP_REASONS[reason] ?? reason.replace(/_/g, ' ')
}

