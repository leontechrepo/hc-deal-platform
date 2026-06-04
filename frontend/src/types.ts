export interface Deal {
  id: number
  company_name: string
  bucket: string | null
  stage: string | null
  location: string | null
  deal_size_m: number | null
  sector_primary: string | null
  sector_full: string | null
  subsector: string | null
  security: string | null
  uop: string | null
  source: string | null
  nda: string | null
  dataroom: string | null
  mgmt_meeting: string | null
  ioi_offered: string | null
  ioi_signed: string | null
  target_close: string | null
  commentary: string | null
  reasons_for_passing: string | null
  last_updated: string | null
  updated_by: string
  total_funded_m: number | null
}

export interface KPIs {
  total_reviewed: number
  closed: number
  active_diligence: number
  active_discussions: number
  passed: number
  deployed_m: number
}

export interface PendingSuggestion {
  id: number
  deal_id: number
  company_name: string
  stage: string | null
  suggested_field: string
  suggested_value: string | null
  claude_summary: string | null
  email_subject: string | null
  current_commentary: string | null
  created_at: string
}

export interface DealUpdateLogEntry {
  id: number
  deal_id: number
  company_name: string
  field_changed: string
  old_value: string | null
  new_value: string | null
  source: string
  changed_at: string
  email_subject: string | null
}

export interface EmailScanLogEntry {
  id: number
  subject: string | null
  user_email: string
  received_at: string | null
  processed_at: string
  matched_deal_id: number | null
  company_name: string | null
  claude_summary: string | null
  action_taken: string | null
}
