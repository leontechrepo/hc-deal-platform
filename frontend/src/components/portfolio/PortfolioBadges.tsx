import { paymentStatusTone, riskTone } from '../../domain/badgeTones'
import { TonedBadge } from '../ui/TonedBadge'

export function PaymentStatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  return <TonedBadge tone={paymentStatusTone(status)}>{status}</TonedBadge>
}

export function RiskBadge({ risk }: { risk: string | null }) {
  if (!risk) return null
  return <TonedBadge tone={riskTone(risk)}>{risk}</TonedBadge>
}
