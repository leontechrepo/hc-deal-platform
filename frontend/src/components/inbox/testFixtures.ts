import type { InboxGroup, PendingSuggestion } from '../../api/inbox'

export function makeSuggestion(partial: Partial<PendingSuggestion> & { id: number }): PendingSuggestion {
  return {
    deal_id: 'deal-1',
    company_name: 'Acme Holdings',
    stage: null,
    pipeline_stage: 'term_sheet',
    kind: 'field_update',
    suggested_field: 'deal_size_m',
    suggested_value: '75',
    evidence: null,
    requires_attention: false,
    claude_summary: null,
    email_subject: null,
    email_snippet: null,
    current_value: '50',
    confidence: 0.9,
    estimated_size_m: null,
    estimated_sector: null,
    payload: null,
    created_at: '2026-01-02T00:00:00Z',
    ...partial,
  }
}

export function makeGroup(partial: Partial<InboxGroup> & { id: string }): InboxGroup {
  return {
    mailbox: null,
    email_subject: null,
    email_from: null,
    email_from_name: null,
    email_snippet: null,
    received_at: null,
    has_attachments: false,
    attachment_count: 0,
    attachment_summary: null,
    attachment_state: 'none',
    source_removed: false,
    scan_action: null,
    documents: [],
    deal_id: null,
    deal_name: null,
    suggestions: [],
    ...partial,
  }
}
