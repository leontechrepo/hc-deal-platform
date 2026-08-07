import { Badge, type BadgeTone } from '../ui/Badge/Badge'

export const STATUSES = ['Active', 'On Hold', 'Passed', 'Dead', 'Closed'] as const

// Mirrors app.domain.pipeline_stage.TERMINAL_STATUSES — the backend rejects
// a status PATCH/PUT landing on one of these without a `reasoning` string.
export const TERMINAL_STATUSES = new Set<string>(['On Hold', 'Passed', 'Dead', 'Closed'])

export const STATUS_TONE: Record<string, BadgeTone> = {
  Active: 'blue',
  'On Hold': 'amber',
  Passed: 'red',
  Dead: 'red',
  Closed: 'green',
}

export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  return <Badge tone={STATUS_TONE[status] ?? 'gray'}>{status}</Badge>
}
