import { useOutletContext } from 'react-router-dom'
import { useState } from 'react'
import { useDealTimeline } from '../../../hooks/useDealTimeline'
import { EmptyState } from '../../../components/ui/EmptyState/EmptyState'
import { Button } from '../../../components/ui/Button/Button'
import { CreateTimelineWizard } from '../../../components/dealDetail/CreateTimelineWizard'
import { GanttChart } from '../../../components/dealDetail/GanttChart'
import type { Deal } from '../../../types'
import styles from './TimelineTab.module.css'

export function TimelineTab() {
  const { deal } = useOutletContext<{ deal: Deal }>()
  const { data: timeline, isLoading, isError } = useDealTimeline(deal.id)
  const [wizardOpen, setWizardOpen] = useState(false)

  if (isLoading) return <div className={styles.state}>Loading timeline…</div>
  if (isError || !timeline) return <div className={styles.state}>Failed to load timeline.</div>

  const hasTimeline = timeline.workstreams.length > 0

  return (
    <div className={styles.tab}>
      <div className={styles.header}>
        <Button variant="secondary" size="sm" onClick={() => setWizardOpen(true)}>
          {hasTimeline ? 'Add From Template' : 'Create Timeline from Template'}
        </Button>
      </div>

      {hasTimeline ? (
        <GanttChart dealId={deal.id} workstreams={timeline.workstreams} />
      ) : (
        <EmptyState
          title="No closing timeline yet"
          description="Create one from a template to track credit documentation, diligence, and closing workstreams."
          action={<Button variant="primary" onClick={() => setWizardOpen(true)}>Create Timeline</Button>}
        />
      )}

      <CreateTimelineWizard dealId={deal.id} open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  )
}
