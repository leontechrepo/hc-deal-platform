import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { KPIStrip } from '../../components/KPIStrip/KPIStrip'
import { ReviewBanner } from '../../components/ReviewBanner/ReviewBanner'
import { PipelineTable } from '../../components/pipeline/PipelineTable'
import { KanbanBoard } from '../../components/pipeline/KanbanBoard'
import { ViewToggle, type View } from '../../components/pipeline/ViewToggle'
import { NewDealModal } from '../../components/pipeline/NewDealModal'
import { Button } from '../../components/ui/Button/Button'
import { Tabs } from '../../components/ui/Tabs/Tabs'
import { STATUSES } from '../../components/shared/StatusBadge'
import { useKPIs } from '../../hooks/useKPIs'
import { useDeals } from '../../hooks/useDeals'
import styles from './PipelinePage.module.css'

const STATUS_TABS = ['Active', ...STATUSES.filter(s => s !== 'Active'), 'All'] as const
type StatusTab = (typeof STATUS_TABS)[number]

export function PipelinePage() {
  const [activeStatus, setActiveStatus] = useState<StatusTab>('Active')
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: kpis } = useKPIs()
  const { data: deals = [], isLoading } = useDeals()

  const view: View = searchParams.get('view') === 'kanban' ? 'kanban' : 'table'
  const newDealOpen = searchParams.get('new') === '1'

  function setView(next: View) {
    const params = new URLSearchParams(searchParams)
    if (next === 'table') params.delete('view')
    else params.set('view', next)
    setSearchParams(params, { replace: true })
  }

  function openNewDeal() {
    const params = new URLSearchParams(searchParams)
    params.set('new', '1')
    setSearchParams(params)
  }

  function closeNewDeal() {
    const params = new URLSearchParams(searchParams)
    params.delete('new')
    setSearchParams(params, { replace: true })
  }

  const visibleDeals = activeStatus === 'All' ? deals : deals.filter(d => d.status === activeStatus)

  return (
    <div className={styles.page}>
      <div className={styles.masthead}>
        <div className={styles.mastheadTitle}>LHP Private Credit</div>
        <div className={styles.mastheadSub}>Deal Pipeline · Confidential</div>
      </div>

      {kpis && <KPIStrip kpis={kpis} />}

      <ReviewBanner />

      <div className={styles.toolbar}>
        <Tabs
          items={STATUS_TABS.map(tab => ({ key: tab, label: tab }))}
          activeKey={activeStatus}
          onChange={key => setActiveStatus(key as StatusTab)}
        />
        <div className={styles.actions}>
          <ViewToggle view={view} onChange={setView} />
          <Button variant="primary" onClick={openNewDeal}>+ New Deal</Button>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.loading}>Loading deals…</div>
      ) : view === 'kanban' ? (
        <KanbanBoard deals={visibleDeals} />
      ) : (
        <PipelineTable deals={visibleDeals} />
      )}

      <NewDealModal open={newDealOpen} onClose={closeNewDeal} />
    </div>
  )
}
