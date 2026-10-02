import { useDealContext } from '../dealContext'
import { useState } from 'react'
import { AlertTriangle, CalendarRange } from 'lucide-react'
import { Button, EmptyState } from '@leontechrepo/leon-ui'
import { useDealTimeline } from '../../../hooks/useDealTimeline'
import { LoadingBlock } from '../../../components/ui/Skeleton/Skeleton'
import { CreateTimelineWizard } from '../../../components/dealDetail/CreateTimelineWizard'
import { GanttChart } from '../../../components/dealDetail/GanttChart'
import styles from './TimelineTab.module.css'

export function TimelineTab() {
  const { deal } = useDealContext()
  const { data: timeline, isLoading, isError, refetch } = useDealTimeline(deal.id)
  const [wizardOpen, setWizardOpen] = useState(false)

  if (isLoading) return <LoadingBlock label="Loading timeline…" lines={4} />
  if (isError || !timeline) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load the timeline"
        action={<Button size="sm" variant="secondary" onClick={() => void refetch()}>Try again</Button>}
      >
        Check your connection and try again.
      </EmptyState>
    )
  }

  const hasTimeline = timeline.workstreams.length > 0

  return (
    <div className={styles.tab}>
      {hasTimeline && (
        <div className={styles.header}>
          <Button variant="secondary" size="sm" onClick={() => setWizardOpen(true)}>
            Add From Template
          </Button>
        </div>
      )}

      {hasTimeline ? (
        <GanttChart dealId={deal.id} workstreams={timeline.workstreams} />
      ) : (
        <EmptyState
          icon={CalendarRange}
          title="No closing timeline yet"
          action={<Button onClick={() => setWizardOpen(true)}>Create Timeline from Template</Button>}
        >
          Create one from a template to track credit documentation, diligence, and closing workstreams.
        </EmptyState>
      )}

      <CreateTimelineWizard dealId={deal.id} open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  )
}
