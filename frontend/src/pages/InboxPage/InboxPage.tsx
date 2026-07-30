import { useMemo } from 'react'
import { useApproveInboxItem, useInbox, useRejectInboxItem } from '../../hooks/useInbox'
import { InboxCard } from '../../components/inbox/InboxCard'
import { EmptyState } from '../../components/ui/EmptyState/EmptyState'
import { KPIGrid } from '../../components/ui/KPIGrid/KPIGrid'
import { useToast } from '../../components/Toast/Toast'
import styles from './InboxPage.module.css'

export function InboxPage() {
  const { data: suggestions = [], isLoading, isError } = useInbox()
  const approve = useApproveInboxItem()
  const reject = useRejectInboxItem()
  const { showToast } = useToast()

  const kpiItems = useMemo(() => [
    { label: 'Pending', value: suggestions.length },
    { label: 'New Deals Detected', value: suggestions.filter(s => s.suggested_field === 'new_deal').length },
    { label: 'High Confidence', value: suggestions.filter(s => (s.confidence ?? 0) >= 0.85).length },
  ], [suggestions])

  if (isLoading) return <div className={styles.state}>Loading inbox…</div>
  if (isError) return <div className={styles.state}>Failed to load inbox.</div>

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.eyebrow}>LHP Private Credit — Deal Platform</div>
        <h1 className={styles.title}>Inbox</h1>
      </header>

      <KPIGrid items={kpiItems} />

      {suggestions.length === 0 ? (
        <EmptyState
          title="Inbox is clear"
          description="New suggestions will appear here as emails are scanned."
        />
      ) : (
        <div className={styles.list}>
          {suggestions.map(s => (
            <InboxCard
              key={s.id}
              suggestion={s}
              busy={approve.isPending || reject.isPending}
              onApprove={async (value) => {
                await approve.mutateAsync({ id: s.id, value })
                showToast(s.suggested_field === 'new_deal' ? `New deal added: ${s.company_name}` : `Approved — ${s.company_name} updated`)
              }}
              onReject={async () => {
                await reject.mutateAsync(s.id)
                showToast(`Rejected suggestion for ${s.company_name}`)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
