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
  timing_qtr: string | null
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
  // Pipeline model (migration 004+)
  pipeline_stage: string | null
  status: string | null
  // Structural / financial / covenant fields (migration 005)
  state: string | null
  next_action: string | null
  sourcing_date: string | null
  contact_name: string | null
  contact_role: string | null
  nda_date: string | null
  nda_status: string | null
  tenor_months: number | null
  amortization: string | null
  oid_pct: number | null
  sofr_floor_pct: number | null
  call_protection: string | null
  maturity_date: string | null
  total_leverage: number | null
  spread_bps: number | null
  base_rate: string | null
  sofr_rate: number | null
  all_in_rate: number | null
  hold_amount_m: number | null
  ltm_revenue_m: number | null
  ltm_ebitda_m: number | null
  ebitda_margin: number | null
  revenue_growth_pct: number | null
  ebitda_growth_pct: number | null
  capex_m: number | null
  fcf_m: number | null
  dscr: number | null
  fccr: number | null
  interest_coverage: number | null
  max_leverage_covenant: number | null
  min_fccr_covenant: number | null
  capex_limit_covenant_m: number | null
  employees: number | null
  locations_count: number | null
  year_founded: number | null
  risk_score: number | null
  deal_team: string[] | null
  underwriting_locked: boolean
}

export interface CreateDealInput {
  company_name: string
  location?: string | null
  sector_primary?: string | null
  sector_full?: string | null
  subsector?: string | null
  security?: string | null
  uop?: string | null
  source?: string | null
  state?: string | null
  contact_name?: string | null
  contact_role?: string | null
  employees?: number | null
  locations_count?: number | null
  year_founded?: number | null
  deal_size_m?: number | null
  hold_amount_m?: number | null
  tenor_months?: number | null
  oid_pct?: number | null
  spread_bps?: number | null
  sofr_rate?: number | null
  sofr_floor_pct?: number | null
  ltm_revenue_m?: number | null
  ltm_ebitda_m?: number | null
  capex_m?: number | null
  ebitda_margin?: number | null
  revenue_growth_pct?: number | null
  max_leverage_covenant?: number | null
  min_fccr_covenant?: number | null
  capex_limit_covenant_m?: number | null
  pipeline_stage?: string
  status?: string
  base_rate?: string | null
  actor?: string
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
  deal_id: number | null
  company_name: string
  stage: string | null
  pipeline_stage: string | null
  suggested_field: string
  suggested_value: string | null
  claude_summary: string | null
  email_subject: string | null
  email_snippet: string | null
  current_value: string | null
  confidence: number | null
  estimated_size_m: number | null
  estimated_sector: string | null
  created_at: string
}

export interface SponsorDealSummary {
  id: number
  company_name: string
  pipeline_stage: string | null
  status: string | null
  deal_size_m: number | null
  total_leverage: number | null
  all_in_rate: number | null
}

export interface Sponsor {
  id: number
  name: string
  sponsor_type: 'PE Sponsor' | 'Strategic' | null
  aum_m: number | null
  focus: string | null
  hq_location: string | null
  fund_vintage: string | null
  contact_name: string | null
  contact_role: string | null
  contact_email: string | null
  contact_phone: string | null
  email_domain: string | null
  coverage_cadence: string | null
  last_contact_date: string | null
  relationship_note: string | null
  deals: SponsorDealSummary[]
  active_deal_count: number
  total_exposure_m: number
}

export type SponsorInput = Omit<Sponsor, 'id' | 'deals' | 'active_deal_count' | 'total_exposure_m'>

export interface FundDealSummary {
  id: number
  company_name: string
  pipeline_stage: string | null
  status: string | null
  deal_size_m: number | null
  hold_amount_m: number | null
  total_leverage: number | null
  all_in_rate: number | null
}

export interface FundLP {
  id: number
  fund_id: number
  name: string
  commitment_m: number | null
  called_m: number | null
}

export type FundLPInput = Omit<FundLP, 'id' | 'fund_id'>

export interface Fund {
  id: number
  name: string
  vintage: string | null
  status: 'Investing' | 'Fundraising' | null
  total_commitment_m: number | null
  called_capital_m: number | null
  deployed_capital_m: number | null
  available_capital_m: number | null
  target_return: string | null
  strategy: string | null
  focus_sectors: string[] | null
  max_single_exposure_pct: number | null
  target_leverage: number | null
  target_hold: string | null
  gp_commitment_m: number | null
  mgmt_fee_pct: number | null
  carried_interest_pct: number | null
  investment_period: string | null
  fund_life: string | null
  lps: FundLP[]
  deals: FundDealSummary[]
}

export type FundInput = Omit<Fund, 'id' | 'lps' | 'deals'>

export interface PortfolioPosition {
  id: number
  deal_id: number
  company_name: string
  sponsor_name: string | null
  funded_date: string | null
  original_amount_m: number | null
  current_balance_m: number | null
  rate: number | null
  payment_status: 'Current' | 'Late' | 'Default' | null
  risk: 'Pass' | 'Watch' | null
  next_test_date: string | null
  covenant_status: string | null
  leverage: number | null
  dscr: number | null
}

export type PortfolioPositionInput = Partial<Omit<PortfolioPosition, 'id' | 'deal_id' | 'company_name' | 'sponsor_name'>>

export interface PortfolioMonitoringTest {
  id: number
  portfolio_position_id: number
  test_date: string
  leverage: number | null
  dscr: number | null
  fccr: number | null
  covenant_status: string | null
  notes: string | null
  created_at: string
}

export type PortfolioTestInput = Omit<PortfolioMonitoringTest, 'id' | 'portfolio_position_id' | 'created_at'>

export interface DealActivity {
  id: number
  deal_id: number
  actor: string | null
  activity_type: string
  description: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface DealNote {
  id: number
  deal_id: number
  author: string | null
  body: string
  created_at: string
  updated_at: string
}

export interface DealTimelineTask {
  id: number
  workstream_id: number
  name: string
  owner: string | null
  start_date: string | null
  end_date: string | null
  duration_days: number | null
  status: string
  is_milestone: boolean
  sort_order: number
}

export interface DealTimelineWorkstream {
  id: number
  name: string
  sort_order: number
  tasks: DealTimelineTask[]
}

export interface DealTimeline {
  deal_id: number
  workstreams: DealTimelineWorkstream[]
}

export interface TimelineTemplate {
  key: string
  label: string
  description: string
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

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  error?: boolean
}

export interface ChatSendResponse {
  session_id: string
  reply: string
  created_at: string
}
