import { Badge, type BadgeTone } from '../ui/Badge/Badge'

export const STATUSES = ['Active', 'On Hold', 'Passed', 'Dead', 'Closed'] as const

export const STATUS_TONE: Record<string, BadgeTone> = {
  Active: 'blue',
  'On Hold': 'yellow',
  Passed: 'red',
  Dead: 'red',
  Closed: 'green',
}

export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  return <Badge tone={STATUS_TONE[status] ?? 'gray'}>{status}</Badge>
}
