import type {
  AttachmentDisposition,
  AttachmentState,
  AttachmentSummaryEntry,
  InboxGroup,
  PendingSuggestion,
} from '../../api/inbox'

import { formatPipelineStage } from '../../domain/stages'

export const STATED_CONFIDENCE_THRESHOLD = 0.85
export const INFERRED_CONFIDENCE_THRESHOLD = 0.75

export type ConfidenceBand = 'stated' | 'inferred' | 'weak'

export function confidenceBand(value: number): ConfidenceBand {
  if (value >= STATED_CONFIDENCE_THRESHOLD) return 'stated'
  if (value >= INFERRED_CONFIDENCE_THRESHOLD) return 'inferred'
  return 'weak'
}

export const CONFIDENCE_HELP: Record<ConfidenceBand, { label: string; meaning: string }> = {
  stated: {
    label: 'Stated',
    meaning: 'The email says this outright (model confidence 85% or higher). Still verify against the evidence.',
  },
  inferred: {
    label: 'Inferred',
    meaning: 'Reasonably implied by the email but not stated word for word (75–85%). Read the evidence before approving.',
  },
  weak: {
    label: 'Weak',
    meaning: 'A guess from thin or ambiguous wording (under 75%). Treat as a lead, not a fact.',
  },
}

/** Credit-terminology labels for every field in app/domain/field_updates.py. */
export const FIELD_LABELS: Record<string, string> = {
  pipeline_stage: 'Pipeline stage',
  status: 'Deal status',
  next_action: 'Next action',
  nda_status: 'NDA status',
  nda_date: 'NDA date',
  target_close: 'Target close date',
  deal_size_m: 'Facility size ($M)',
  hold_amount_m: 'Hold amount ($M)',
  spread_bps: 'Spread (bps over SOFR)',
  total_leverage: 'Total leverage (x EBITDA)',
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
  commentary: 'Deal commentary',
  new_deal: 'New deal',
  sponsor_id: 'Sponsor',
}

export function fieldLabel(field: string | null | undefined): string {
  if (!field) return 'Update'
  const known = FIELD_LABELS[field]
  if (known) return known
  const spaced = field.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const MONEY_FIELDS = new Set(['deal_size_m', 'hold_amount_m', 'ltm_revenue_m', 'ltm_ebitda_m'])
const PCT_FIELDS = new Set(['ebitda_margin', 'oid_pct', 'sofr_floor_pct'])

/**
 * Display form of a stored deal value, matching how proposals are shown
 * ("70.00M", "475 bps", "1.0%") so Current and Proposed read the same way.
 * Pipeline stages show their label ("Pre-LOI Diligence"), never the enum.
 */
export function formatFieldValue(field: string | null | undefined, raw: string | null | undefined): string {
  if (raw == null || raw === '') return ''
  if (field === 'pipeline_stage') return formatPipelineStage(raw) ?? raw
  const n = Number(raw)
  if (!Number.isFinite(n)) return raw
  if (field && MONEY_FIELDS.has(field)) return `${n.toFixed(2)}M`
  if (field === 'spread_bps') return `${Math.round(n)} bps`
  if (field && PCT_FIELDS.has(field)) return `${n}%`
  return raw
}

export type SuggestionKind = 'field_update' | 'commentary' | 'new_deal'

export function suggestionKind(s: PendingSuggestion): SuggestionKind {
  if (s.kind === 'new_deal' || s.suggested_field === 'new_deal') return 'new_deal'
  if (s.kind === 'commentary' || s.suggested_field === 'commentary') return 'commentary'
  return 'field_update'
}

export const KIND_LABELS: Record<SuggestionKind, string> = {
  field_update: 'Field update',
  commentary: 'Commentary',
  new_deal: 'New deal',
}

export function summariseKinds(suggestions: PendingSuggestion[]): string {
  const counts = new Map<SuggestionKind, number>()
  for (const s of suggestions) {
    const k = suggestionKind(s)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return [...counts]
    .map(([k, n]) => `${n} ${KIND_LABELS[k].toLowerCase()}${n === 1 ? '' : 's'}`)
    .join(' · ')
}

export const ATTACHMENTS_DISABLED_COPY =
  'Attachment ingestion is disabled — files from this email are not stored'

export interface AttachmentStateCopy {
  label: string
  detail: string
  tone: 'gray' | 'amber' | 'green' | 'red'
}

/**
 * Maps the backend's attachment_state to UI copy. `ingestionEnabled` comes from
 * /api/meta/features (undefined while loading): a "pending" email on a server
 * with ingestion off is shown as disabled, and we never imply ingestion is
 * active before the features endpoint says so.
 */
export function attachmentStateCopy(
  state: AttachmentState,
  ingestionEnabled: boolean | undefined,
): AttachmentStateCopy | null {
  const effective: AttachmentState =
    state === 'pending' && ingestionEnabled === false ? 'disabled' : state
  switch (effective) {
    case 'none':
      return null
    case 'disabled':
      return { label: 'Not stored', detail: ATTACHMENTS_DISABLED_COPY, tone: 'gray' }
    case 'pending':
      return {
        label: 'Pending',
        detail: 'Attachments have not been ingested yet — they will be processed on the next scan',
        tone: 'amber',
      }
    case 'failed':
      return {
        label: 'Failed',
        detail: 'At least one attachment could not be stored; the scanner will retry',
        tone: 'red',
      }
    case 'ingested':
      return { label: 'Ingested', detail: 'All attachments have been processed', tone: 'green' }
  }
}

const SKIP_REASONS: Record<string, string> = {
  message_budget: 'Skipped — per-email attachment limit reached',
  empty_body: 'Skipped — the attachment was empty',
  no_attachment_id: 'Skipped — no downloadable attachment id',
  inline: 'Skipped — inline image (signature or logo)',
  inline_image: 'Skipped — inline image (signature or logo)',
  too_large: 'Skipped — file is too large',
  size_limit: 'Skipped — file is too large',
  unsupported_type: 'Skipped — unsupported file type',
  disallowed_type: 'Skipped — unsupported file type',
  disallowed_extension: 'Skipped — unsupported file type',
  ingestion_disabled: 'Skipped — attachment ingestion is disabled',
}

export interface DispositionCopy {
  label: string
  tone: 'green' | 'gray' | 'amber' | 'red'
  detail: string
}

export function dispositionCopy(entry: AttachmentSummaryEntry): DispositionCopy {
  const reason = entry.reason ?? null
  switch (entry.disposition) {
    case 'stored':
      return { label: 'Stored', tone: 'green', detail: 'Saved to document storage' }
    case 'duplicate':
      return {
        label: 'Duplicate',
        tone: 'gray',
        detail: 'Already stored — an identical file exists, so it was not saved again',
      }
    case 'skipped':
      return {
        label: 'Skipped',
        tone: 'amber',
        detail: reason ? (SKIP_REASONS[reason] ?? `Skipped — ${reason.replace(/_/g, ' ')}`) : 'Skipped',
      }
    case 'failed': {
      const attempts = entry.attempts ?? 0
      const tries = attempts > 0 ? ` after ${attempts} attempt${attempts === 1 ? '' : 's'}` : ''
      return {
        label: 'Failed',
        tone: 'red',
        detail: `Could not be stored${tries}${reason ? ` — ${reason}` : ''}`,
      }
    }
    default:
      return { label: 'Not processed', tone: 'gray', detail: 'No outcome recorded yet' }
  }
}

/** "2 stored · 1 skipped · 1 duplicate" plus how many stored files still need filing. */
export function attachmentTally(
  entries: AttachmentSummaryEntry[],
  documents: InboxGroup['documents'],
): { text: string; unfiled: number } {
  const counts: Record<string, number> = {}
  for (const e of entries) counts[e.disposition ?? 'other'] = (counts[e.disposition ?? 'other'] ?? 0) + 1
  const order: Array<[string, string]> = [
    ['stored', 'stored'],
    ['duplicate', 'duplicate'],
    ['skipped', 'skipped'],
    ['failed', 'failed'],
  ]
  const parts = order.filter(([k]) => counts[k]).map(([k, label]) => `${counts[k]} ${label}`)
  return {
    text: parts.length ? `All processed — ${parts.join(' · ')}` : 'No attachment outcomes recorded yet',
    unfiled: documents.filter((d) => !d.filed).length,
  }
}

export function isDisposition(v: unknown): v is AttachmentDisposition {
  return v === 'stored' || v === 'duplicate' || v === 'skipped' || v === 'failed'
}

export function formatBytes(n: number | null | undefined): string {
  if (n == null) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function groupDocumentFor(
  group: InboxGroup,
  entry: AttachmentSummaryEntry,
): InboxGroup['documents'][number] | undefined {
  if (entry.document_id == null) return undefined
  return group.documents.find((d) => d.id === entry.document_id)
}

/** Resolve the selected group: keep the user's pick if still present, else the first visible one. */
export function resolveActiveGroup(
  visible: InboxGroup[],
  selectedId: string | null,
): InboxGroup | null {
  if (selectedId === null) return null
  return visible.find((g) => g.id === selectedId) ?? null
}

/** Pull the backend `detail` out of ApiError("API POST /x → 400: {json}"). */
export function apiErrorDetail(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  const idx = message.indexOf('{')
  if (idx >= 0) {
    try {
      const parsed = JSON.parse(message.slice(idx)) as { detail?: unknown }
      if (typeof parsed.detail === 'string') return parsed.detail
      if (Array.isArray(parsed.detail)) {
        return parsed.detail
          .map((d) => (d && typeof d === 'object' && 'msg' in d ? String((d as { msg: unknown }).msg) : ''))
          .filter(Boolean)
          .join('; ')
      }
    } catch {
      // fall through
    }
  }
  return message
}

export function formatReceived(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const PERSONAL_DOMAINS = new Set(['gmail', 'outlook', 'hotmail', 'yahoo', 'icloud'])

export function senderLabel(address: string | null, name: string | null): string {
  if (!address) return name ?? 'unknown sender'
  const domain = address.split('@')[1]?.toLowerCase()
  const root = domain?.split('.').slice(0, -1).join('.').replace(/[^a-z0-9]/g, '')
  const firm =
    root && !PERSONAL_DOMAINS.has(root)
      ? root.length <= 4
        ? root.toUpperCase()
        : root.charAt(0).toUpperCase() + root.slice(1)
      : null
  if (!name) return firm ? `${address} · ${firm}` : address
  return firm ? `${name} · ${firm}` : name
}


export const EMAIL_BODY_UNAVAILABLE: Record<string, string> = {
  no_source_email: 'This item has no source email to read.',
  graph_not_configured: 'Mailbox access is not configured on this server, so only the stored preview is shown.',
  graph_error: 'The mailbox could not be reached just now, so only the stored preview is shown.',
  removed: 'The email is no longer in the mailbox, so only the stored preview is shown.',
}
