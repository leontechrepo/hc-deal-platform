import { Activity } from 'lucide-react'
import { useDealContext } from '../dealContext'
import { useDealActivity } from '../../../hooks/useDealDetail'
import { DataTable, type Column } from '../../../components/ui/DataTable/DataTable'
import { DataSection } from '../../../components/dealDetail/DataSection'
import { TonedBadge } from '../../../components/ui/TonedBadge'
import { activityTone } from '../../../domain/badgeTones'
import type { DealActivity } from '../../../types'

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

const columns: Column<DealActivity>[] = [
  { key: 'date', header: 'Date', render: a => fmtDate(a.created_at) },
  { key: 'type', header: 'Type', render: a => <TonedBadge tone={activityTone(a.activity_type)}>{a.activity_type}</TonedBadge> },
  { key: 'description', header: 'Description', width: 320, render: a => a.description },
  { key: 'actor', header: 'Actor', render: a => a.actor ?? '—' },
]

export function ActivityTab() {
  const { deal } = useDealContext()
  const { data: activity = [], isLoading, isError } = useDealActivity(deal.id)

  return (
    <DataSection
      title="Activity"
      noun="activity"
      isLoading={isLoading}
      isError={isError}
      isEmpty={activity.length === 0}
      emptyIcon={Activity}
      emptyTitle="No activity yet"
      emptyDescription="Activity is logged automatically as this deal moves through the pipeline."
    >
      <DataTable columns={columns} rows={activity} rowKey={a => a.id} />
    </DataSection>
  )
}
