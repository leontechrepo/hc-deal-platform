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
      <button className={styles.approveBtn} disabled={busy} onClick={onApprove}>
        {approveLabel}
      </button>
      <button className={styles.rejectBtn} disabled={busy} onClick={onReject}>
        {rejectLabel}
      </button>
    </div>
  )
}
