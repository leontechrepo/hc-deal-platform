import { Badge, type BadgeTone } from '../ui/Badge/Badge'

const PAYMENT_STATUS_TONE: Record<string, BadgeTone> = {
  Current: 'green',
  Late: 'yellow',
  Default: 'red',
}

const RISK_TONE: Record<string, BadgeTone> = {
  Pass: 'green',
  Watch: 'orange',
}

export function PaymentStatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  return <Badge tone={PAYMENT_STATUS_TONE[status] ?? 'gray'}>{status}</Badge>
}

export function RiskBadge({ risk }: { risk: string | null }) {
  if (!risk) return null
  return <Badge tone={RISK_TONE[risk] ?? 'gray'}>{risk}</Badge>
}
