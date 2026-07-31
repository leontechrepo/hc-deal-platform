import { Button } from '../Button/Button'
import styles from './ApproveRejectActions.module.css'

interface Props {
  onApprove: () => void
  onReject: () => void
  busy?: boolean
  approveLabel?: string
  rejectLabel?: string
}

export function ApproveRejectActions({
  onApprove,
  onReject,
  busy = false,
  approveLabel = 'Approve',
  rejectLabel = 'Reject',
}: Props) {
  return (
    <div className={styles.actions}>
      <Button variant="primary" size="sm" disabled={busy} onClick={onApprove}>
        {approveLabel}
      </Button>
      <Button variant="secondary" size="sm" disabled={busy} onClick={onReject}>
        {rejectLabel}
      </Button>
    </div>
  )
}
