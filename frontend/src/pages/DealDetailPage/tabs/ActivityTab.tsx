import { useOutletContext } from 'react-router-dom'
import { useDealActivity } from '../../../hooks/useDealDetail'
import { DataTable, type Column } from '../../../components/ui/DataTable/DataTable'
import { EmptyState } from '../../../components/ui/EmptyState/EmptyState'
import { Badge, type BadgeTone } from '../../../components/ui/Badge/Badge'
import type { Deal, DealActivity } from '../../../types'
import styles from './ActivityTab.module.css'

const ACTIVITY_TONE: Record<string, BadgeTone> = {
  stage_change: 'purple',
  document: 'blue',
  note: 'gray',
  approval: 'green',
  system: 'gray',
  email: 'blue',
  status_change: 'gold',
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

const columns: Column<DealActivity>[] = [
  { key: 'date', header: 'Date', render: a => fmtDate(a.created_at) },
  { key: 'type', header: 'Type', render: a => <Badge tone={ACTIVITY_TONE[a.activity_type] ?? 'gray'}>{a.activity_type}</Badge> },
  { key: 'description', header: 'Description', width: 320, render: a => a.description },
  { key: 'actor', header: 'Actor', render: a => a.actor ?? '—' },
]

export function ActivityTab() {
  const { deal } = useOutletContext<{ deal: Deal }>()
  const { data: activity = [], isLoading, isError } = useDealActivity(deal.id)

  if (isLoading) return <div className={styles.state}>Loading activity…</div>
  if (isError) return <div className={styles.state}>Failed to load activity.</div>

  if (activity.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        description="Activity is logged automatically as this deal moves through the pipeline."
      />
    )
  }

  return <DataTable columns={columns} rows={activity} rowKey={a => a.id} />
}
