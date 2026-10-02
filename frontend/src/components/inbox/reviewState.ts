import type {
  AcceptGroupBody,
  InboxGroup,
  NewDealForm,
  PendingSuggestion,
} from '../../api/inbox'
import { apiErrorDetail, confidenceBand, suggestionKind } from './inboxCopy'

/** A field is flagged for a closer look when the model called it a guess. */
export function isLowConfidence(s: PendingSuggestion): boolean {
  return s.confidence !== null && confidenceBand(s.confidence) === 'weak'
}

/** One badge per email: the most cautious band among its suggestions. */
export function lowestConfidence(suggestions: PendingSuggestion[]): number | null {
  return suggestions.reduce<number | null>(
    (low, s) => (s.confidence !== null && (low === null || s.confidence < low) ? s.confidence : low),
    null,
  )
}

export interface ReviewParts {
  newDeal: PendingSuggestion | null
  updates: PendingSuggestion[]
}

export function splitSuggestions(group: InboxGroup): ReviewParts {
  const newDeal = group.suggestions.find((s) => suggestionKind(s) === 'new_deal') ?? null
  const updates = group.suggestions.filter((s) => suggestionKind(s) !== 'new_deal')
  return { newDeal, updates }
}

export interface NewDealDraft {
  company_name: string
  sector: string
  deal_size_m: string
  summary: string
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/** Pre-fill for the new-deal form, from the stored payload (or its JSON mirror). */
export function newDealDraft(s: PendingSuggestion | null): NewDealDraft {
  if (!s) return { company_name: '', sector: '', deal_size_m: '', summary: '' }
  let source: Record<string, unknown> = s.payload ?? {}
  if (!('company_name' in source) && s.suggested_value) {
    try {
      source = JSON.parse(s.suggested_value) as Record<string, unknown>
    } catch {
      source = {}
    }
  }
  const size = s.estimated_size_m ?? (typeof source.estimated_size_m === 'number' ? source.estimated_size_m : null)
  return {
    company_name: str(source.company_name) || s.company_name,
    sector: str(source.sector) || (s.estimated_sector ?? ''),
    deal_size_m: size !== null && size !== undefined ? String(size) : '',
    summary: str(source.summary) || (s.claude_summary ?? ''),
  }
}

export interface ReviewState {
  values: Record<number, string>
  included: Record<number, boolean>
  dealId: string | null
  newDeal: NewDealDraft
  linkMode: boolean
  linkedDealId: string | null
  reasoning: string
  allowStageSkip: boolean
}

export function initialReviewState(group: InboxGroup): ReviewState {
  const { newDeal, updates } = splitSuggestions(group)
  return {
    values: Object.fromEntries(updates.map((s) => [s.id, s.suggested_value ?? ''])),
    included: Object.fromEntries(updates.map((s) => [s.id, true])),
    dealId: group.deal_id,
    newDeal: newDealDraft(newDeal),
    linkMode: false,
    linkedDealId: null,
    reasoning: '',
    allowStageSkip: false,
  }
}

export function includedCount(parts: ReviewParts, state: ReviewState): number {
  return parts.updates.filter((s) => state.included[s.id] ?? true).length
}

/** Why the primary action is unavailable, or null when it can run. */
export function blockingReason(parts: ReviewParts, state: ReviewState): string | null {
  if (parts.newDeal) {
    if (state.linkMode && !state.linkedDealId) return 'Pick the deal to link this email to.'
    if (!state.linkMode && !state.newDeal.company_name.trim()) return 'Enter the company name.'
    return null
  }
  const n = includedCount(parts, state)
  if (n === 0) return 'Tick at least one change to apply, or dismiss the email.'
  if (!state.dealId && parts.updates.some((s) => (state.included[s.id] ?? true) && !s.deal_id)) {
    return 'Pick the deal these changes belong to.'
  }
  return null
}

export function buildAcceptBody(parts: ReviewParts, state: ReviewState): AcceptGroupBody {
  const body: AcceptGroupBody = {
    fields: parts.updates.map((s) => ({
      suggestion_id: s.id,
      value: state.values[s.id] ?? s.suggested_value ?? '',
      include: state.included[s.id] ?? true,
    })),
  }
  if (parts.newDeal) {
    if (state.linkMode) {
      body.deal_id = state.linkedDealId
    } else {
      const d = state.newDeal
      const form: NewDealForm = {
        company_name: d.company_name.trim(),
        sector: d.sector.trim() || null,
        deal_size_m: d.deal_size_m.trim() || null,
        summary: d.summary.trim() || null,
      }
      body.new_deal = form
    }
  } else if (state.dealId) {
    body.deal_id = state.dealId
  }
  if (state.reasoning.trim()) body.reasoning = state.reasoning.trim()
  if (state.allowStageSkip) body.allow_stage_skip = true
  return body
}

export interface RowError {
  status: number
  message: string
}

export interface AcceptFailure {
  rows: Record<number, RowError>
  /** Failure not tied to one field (network, 404, bad company name, …). */
  general: string | null
  /** The server wants a written reason before it will apply a stage skip or terminal status. */
  needsReasoning: 'stage_skip' | 'reasoning' | null
}

/** Turn the 422 `{errors: [...]}` body (or any other failure) into per-field messages. */
export function parseAcceptError(err: unknown): AcceptFailure {
  const failure: AcceptFailure = { rows: {}, general: null, needsReasoning: null }
  const raw = err instanceof Error ? err.message : String(err)
  const idx = raw.indexOf('{')
  if (idx >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(idx)) as { detail?: unknown }
      const detail = parsed.detail
      if (detail && typeof detail === 'object' && !Array.isArray(detail) && 'errors' in detail) {
        const errors = (detail as { errors: Array<{ suggestion_id: number; status: number; message: string }> }).errors
        for (const e of errors) {
          failure.rows[e.suggestion_id] = { status: e.status, message: e.message }
          if (/skip pipeline stages/i.test(e.message)) failure.needsReasoning = 'stage_skip'
          else if (/reasoning required/i.test(e.message) && failure.needsReasoning !== 'stage_skip') {
            failure.needsReasoning = 'reasoning'
          }
        }
        return failure
      }
    } catch {
      // fall through to the generic message
    }
  }
  failure.general = apiErrorDetail(err)
  return failure
}
