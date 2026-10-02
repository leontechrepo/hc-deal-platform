import { apiFetch } from './client'

export type AttachmentDisposition = 'stored' | 'duplicate' | 'skipped' | 'failed'
export type AttachmentState = 'none' | 'disabled' | 'pending' | 'ingested' | 'failed'

export interface AttachmentSummaryEntry {
  name: string | null
  content_type?: string | null
  size?: number | null
  inline?: boolean
  graph_attachment_id?: string | null
  disposition?: AttachmentDisposition | null
  reason?: string | null
  attempts?: number | null
  document_id?: number | null
  sha256?: string | null
}

export interface InboxDocument {
  id: number
  name: string
  doc_type: string | null
  content_type?: string | null
  size_bytes: number | null
  sha256: string | null
  deal_id: string | null
  filed: boolean
  processing_status: string | null
  human_review_required: boolean
  skip_reason: string | null
}

export interface PendingSuggestion {
  id: number
  deal_id: string | null
  company_name: string
  stage: string | null
  pipeline_stage: string | null
  kind: string
  suggested_field: string
  suggested_value: string | null
  evidence: string | null
  requires_attention: boolean
  claude_summary: string | null
  email_subject: string | null
  email_snippet: string | null
  current_value: string | null
  confidence: number | null
  estimated_size_m: number | null
  estimated_sector: string | null
  payload: Record<string, unknown> | null
  created_at: string
}

/** GET /api/inbox groups suggestions (and attachment outcomes) by source email. */
export interface InboxGroup {
  id: string
  mailbox: string | null
  email_subject: string | null
  email_from: string | null
  email_from_name: string | null
  email_snippet: string | null
  received_at: string | null
  has_attachments: boolean
  attachment_count: number
  attachment_summary: AttachmentSummaryEntry[] | null
  attachment_state: AttachmentState
  source_removed: boolean
  scan_action: string | null
  documents: InboxDocument[]
  deal_id: string | null
  deal_name: string | null
  suggestions: PendingSuggestion[]
}

export interface UnfiledDocument {
  id: number
  name: string
  doc_type: string | null
  size_bytes: number | null
  sha256: string | null
  source: string | null
  email_scan_log_id: number | null
  processing_status: string | null
  email_subject: string | null
  email_from: string | null
  email_received_at: string | null
  created_at: string
}

export function listInbox(): Promise<InboxGroup[]> {
  return apiFetch('/api/inbox')
}

export interface NewDealForm {
  company_name: string
  sector?: string | null
  deal_size_m?: string | null
  summary?: string | null
}

export interface GroupFieldDecision {
  suggestion_id: number
  value: string | null
  include: boolean
}

/** One reviewed decision for a whole email: edited values, applied together. */
export interface AcceptGroupBody {
  deal_id?: string | null
  new_deal?: NewDealForm
  fields: GroupFieldDecision[]
  allow_stage_skip?: boolean
  reasoning?: string | null
}

export interface AcceptGroupResult {
  ok: boolean
  deal_id: string | null
  company_name: string | null
  created: boolean
  linked: boolean
  applied: number[]
  rejected: number[]
  /** Suggestions the form never showed (they arrived after it loaded); still pending. */
  remaining: number
  extraction_run_id?: string | null
}

export function acceptInboxGroup(groupId: string, body: AcceptGroupBody): Promise<AcceptGroupResult> {
  return apiFetch(`/api/inbox/groups/${encodeURIComponent(groupId)}/accept`, {
    method: 'POST',
    body: JSON.stringify({
      deal_id: body.deal_id ?? null,
      new_deal: body.new_deal ?? null,
      fields: body.fields,
      allow_stage_skip: body.allow_stage_skip ?? false,
      reasoning: body.reasoning ?? null,
    }),
  })
}

export function dismissInboxGroup(groupId: string): Promise<{ ok: boolean; rejected: number[] }> {
  return apiFetch(`/api/inbox/groups/${encodeURIComponent(groupId)}/dismiss`, { method: 'POST' })
}

export function listUnfiledDocuments(): Promise<UnfiledDocument[]> {
  return apiFetch('/api/inbox/unfiled-documents')
}

export interface FileDocumentResult {
  ok: boolean
  deal_id?: string
  filed: boolean
  duplicate_of?: number
  extraction_run_id?: string | null
}

export function fileUnfiledDocument(docId: number, dealId: string): Promise<FileDocumentResult> {
  return apiFetch(`/api/inbox/unfiled-documents/${docId}/file`, {
    method: 'POST',
    body: JSON.stringify({ deal_id: dealId }),
  })
}

export type EmailBodyReason = 'no_source_email' | 'graph_not_configured' | 'graph_error' | 'removed'

export interface EmailBody {
  available: boolean
  reason: EmailBodyReason | null
  body: string | null
  truncated?: boolean
}

/** Full message body, read live from Graph (never stored server-side). */
export function readInboxEmail(groupId: string): Promise<EmailBody> {
  return apiFetch(`/api/inbox/groups/${encodeURIComponent(groupId)}/email`)
}
