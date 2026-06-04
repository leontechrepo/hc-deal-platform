import { useState } from 'react'
import { KPIStrip } from '../../components/KPIStrip/KPIStrip'
import { ReviewBanner } from '../../components/ReviewBanner/ReviewBanner'
import { DealTable } from '../../components/DealTable/DealTable'
import { useKPIs } from '../../hooks/useKPIs'
import { useDeals } from '../../hooks/useDeals'
import type { Deal } from '../../types'
import styles from './DashboardPage.module.css'

type Tab = 'closed' | 'diligence' | 'discussions' | 'all-active'

const TABS: { id: Tab; label: string }[] = [
  { id: 'closed', label: 'Closed' },
  { id: 'diligence', label: 'Active Diligence' },
  { id: 'discussions', label: 'Active Discussions' },
  { id: 'all-active', label: 'All Active' },
]

function filterDeals(deals: Deal[], tab: Tab): Deal[] {
  switch (tab) {
    case 'closed':      return deals.filter(d => d.bucket === 'Closed')
    case 'diligence':   return deals.filter(d => d.bucket === 'Active-Diligence')
    case 'discussions': return deals.filter(d => d.bucket === 'Active-Discussions')
    case 'all-active':  return deals.filter(d => d.bucket === 'Active-Diligence' || d.bucket === 'Active-Discussions')
  }
}

export function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('diligence')
  const { data: kpis } = useKPIs()
  const { data: deals = [], isLoading } = useDeals()

  const visibleDeals = filterDeals(deals, activeTab)

  return (
    <div className={styles.page}>
      <div className={styles.masthead}>
        <div className={styles.mastheadTitle}>LHP Private Credit</div>
        <div className={styles.mastheadSub}>Deal Pipeline · Confidential</div>
      </div>

      {kpis && <KPIStrip kpis={kpis} />}

      <ReviewBanner />

      <div className={styles.tabs}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={[styles.tab, activeTab === tab.id ? styles.active : ''].join(' ')}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className={styles.loading}>Loading deals…</div>
      ) : (
        <DealTable deals={visibleDeals} showStage={activeTab === 'all-active'} />
      )}
    </div>
  )
}
