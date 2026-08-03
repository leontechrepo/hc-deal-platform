import { useMemo } from 'react'
import { useApproveInboxItem, useInbox, useRejectInboxItem } from '../../hooks/useInbox'
import { useCurrentActor } from '../../hooks/useCurrentActor'
import { InboxCard } from '../../components/inbox/InboxCard'
import { EmptyState } from '../../components/ui/EmptyState/EmptyState'
import { KPIGrid } from '../../components/ui/KPIGrid/KPIGrid'
import { PageShell } from '../../components/ui/PageShell/PageShell'
import { useToast } from '../../components/Toast/Toast'
import styles from './InboxPage.module.css'

const SHELL = { title: 'Inbox', sub: 'Proposed updates awaiting your review' }

export function InboxPage() {
  const { data: suggestions = [], isLoading, isError } = useInbox()
  const approve = useApproveInboxItem()
  const reject = useRejectInboxItem()
  const actor = useCurrentActor()
  const { showToast } = useToast()

  const kpiItems = useMemo(() => [
    { label: 'Pending', value: suggestions.length },
    { label: 'New Deals Detected', value: suggestions.filter(s => s.suggested_field === 'new_deal').length },
    { label: 'High Confidence', value: suggestions.filter(s => (s.confidence ?? 0) >= 0.85).length },
  ], [suggestions])

  if (isLoading) return <PageShell {...SHELL}><div className={styles.state}>Loading inbox…</div></PageShell>
  if (isError) return <PageShell {...SHELL}><div className={styles.state}>Failed to load inbox.</div></PageShell>

  return (
    <PageShell {...SHELL}>
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
              onApprove={async (value, dealId) => {
                const result = await approve.mutateAsync({
                  id: s.id,
                  value,
                  reviewer: actor,
                  dealId: dealId ? Number(dealId) : undefined,
                })
                showToast(
                  s.suggested_field === 'new_deal'
                    ? `New deal added: ${s.company_name}`
                    : `Approved — ${result.company_name} updated`
                )
              }}
              onReject={async () => {
                await reject.mutateAsync({ id: s.id, reviewer: actor })
                showToast(`Rejected suggestion for ${s.company_name}`)
              }}
            />
          ))}
        </div>
      )}
    </PageShell>
  )
}
