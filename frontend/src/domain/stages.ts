/**
 * The 11-stage credit funnel. Mirrors `app/domain/pipeline_stage.py` — the
 * backend is the source of truth; keep this in sync when stages change.
 */
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

export type PipelineStage = (typeof PIPELINE_STAGES)[number]

export const PIPELINE_STAGE_LABEL: Record<string, string> = {
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

export const STATUSES = ['Active', 'On Hold', 'Passed', 'Dead', 'Closed'] as const

/** Mirrors `TERMINAL_STATUSES`: the backend rejects these without a `reasoning` string. */
export const TERMINAL_STATUSES: ReadonlySet<string> = new Set(['On Hold', 'Passed', 'Dead', 'Closed'])

/** Underwriting fields become read-only once a deal reaches this stage or later. */
export const UNDERWRITING_LOCK_STAGE: PipelineStage = 'loi_signed'

export function formatPipelineStage(stage: string | null | undefined): string | null {
  if (!stage) return null
  return PIPELINE_STAGE_LABEL[stage] ?? stage
}

export function stageIndex(stage: string | null | undefined): number {
  if (!stage) return -1
  return (PIPELINE_STAGES as readonly string[]).indexOf(stage)
}

/** True once a deal is at or past the underwriting lock stage. */
export function isAtOrPastLockStage(stage: string | null | undefined): boolean {
  const idx = stageIndex(stage)
  return idx >= stageIndex(UNDERWRITING_LOCK_STAGE)
}

export type StageMove =
  | { kind: 'same' }
  | { kind: 'forward' }
  | { kind: 'back' }
  | { kind: 'skip'; skipped: string[] }

/**
 * Classify a move through the funnel. Forward jumps over two or more stages
 * are "skips" and need a recorded reason; backward moves are frictionless.
 */
export function classifyMove(from: string | null | undefined, to: string): StageMove {
  if (from === to) return { kind: 'same' }
  const a = stageIndex(from)
  const b = stageIndex(to)
  if (b < 0) return { kind: 'forward' }
  if (a < 0) return b > 0 ? { kind: 'skip', skipped: PIPELINE_STAGES.slice(0, b) } : { kind: 'forward' }
  if (b < a) return { kind: 'back' }
  if (b - a >= 2) return { kind: 'skip', skipped: PIPELINE_STAGES.slice(a + 1, b) }
  return { kind: 'forward' }
}

export function statusNeedsReason(status: string): boolean {
  return TERMINAL_STATUSES.has(status)
}
