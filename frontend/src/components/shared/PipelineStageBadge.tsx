import { Badge, type BadgeTone } from '../ui/Badge/Badge'

export const PIPELINE_STAGES = [
  'sourcing',
  'intake_triage',
  'nda_execution',
  'screening',
  'pre_loi_diligence',
  'loi_negotiation',
  'loi_signed',
  'post_loi_diligence',
  'ic_approval',
  'documentation',
  'portfolio_monitoring',
] as const

const PIPELINE_STAGE_TONE: Record<string, BadgeTone> = {
  sourcing: 'gray',
  intake_triage: 'gray',
  nda_execution: 'blue',
  screening: 'blue',
  pre_loi_diligence: 'blue',
  loi_negotiation: 'navy',
  loi_signed: 'navy',
  post_loi_diligence: 'gold',
  ic_approval: 'gold',
  documentation: 'gold',
  portfolio_monitoring: 'green',
}

const PIPELINE_STAGE_LABEL: Record<string, string> = {
  sourcing: 'Sourcing',
  intake_triage: 'Intake / Triage',
  nda_execution: 'NDA Execution',
  screening: 'Screening',
  pre_loi_diligence: 'Pre-LOI Diligence',
  loi_negotiation: 'LOI Negotiation',
  loi_signed: 'LOI Signed',
  post_loi_diligence: 'Post-LOI Diligence',
  ic_approval: 'IC Approval',
  documentation: 'Documentation',
  portfolio_monitoring: 'Portfolio Monitoring',
}

export function formatPipelineStage(stage: string | null): string | null {
  if (!stage) return null
  return PIPELINE_STAGE_LABEL[stage] ?? stage
}

export function PipelineStageBadge({ stage }: { stage: string | null }) {
  if (!stage) return null
  const tone = PIPELINE_STAGE_TONE[stage] ?? 'gray'
  return <Badge tone={tone}>{formatPipelineStage(stage)}</Badge>
}
