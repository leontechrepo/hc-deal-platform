import { statusTone } from '../../domain/badgeTones'
import { TonedBadge } from '../ui/TonedBadge'

export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  return <TonedBadge tone={statusTone(status)}>{status}</TonedBadge>
}
