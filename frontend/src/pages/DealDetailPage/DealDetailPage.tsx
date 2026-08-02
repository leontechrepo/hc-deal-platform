import { Link, Outlet, useParams } from 'react-router-dom'
import { useDeal } from '../../hooks/useDeals'
import { KPIGrid } from '../../components/ui/KPIGrid/KPIGrid'
import { Tabs } from '../../components/ui/Tabs/Tabs'
import { PipelineStageBadge } from '../../components/shared/PipelineStageBadge'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { StageTracker } from '../../components/shared/StageTracker'
import type { Deal } from '../../types'
import styles from './DealDetailPage.module.css'

function fmtM(value: number | null): string {
  return value === null ? '—' : `$${value.toFixed(2)}M`
}

function fmtX(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(2)}x`
}

export function DealDetailPage() {
  const { dealId } = useParams<{ dealId: string }>()
  const id = Number(dealId)
  const { data: deal, isLoading, isError } = useDeal(Number.isFinite(id) ? id : null)

  if (isLoading) return <div className={styles.state}>Loading deal…</div>
  if (isError || !deal) return <div className={styles.state}>Failed to load deal.</div>

  const kpiItems = [
    { label: 'Deal Size', value: fmtM(deal.deal_size_m) },
    { label: 'Total Leverage', value: fmtX(deal.total_leverage) },
    { label: 'All-In Rate', value: deal.all_in_rate !== null ? `${deal.all_in_rate.toFixed(2)}%` : '—' },
    { label: 'Risk Score', value: deal.risk_score !== null ? deal.risk_score.toFixed(1) : '—' },
  ]

  return (
    <div className={styles.page}>
      <Link to="/pipeline" className={styles.backLink}>← Pipeline</Link>

      <div className={styles.topbar}>
        <h1 className={styles.title}>{deal.company_name}</h1>
        <div className={styles.badges}>
          <PipelineStageBadge stage={deal.pipeline_stage} />
          <StatusBadge status={deal.status} />
        </div>
      </div>

      <KPIGrid items={kpiItems} />

      <StageTracker currentStage={deal.pipeline_stage} />

      <Tabs
        items={[
          { key: 'overview', label: 'Overview', to: `/deals/${deal.id}/overview` },
          { key: 'underwriting', label: 'Underwriting', to: `/deals/${deal.id}/underwriting` },
          { key: 'timeline', label: 'Timeline', to: `/deals/${deal.id}/timeline` },
          { key: 'formulas', label: 'Formulas', to: `/deals/${deal.id}/formulas` },
          { key: 'activity', label: 'Activity', to: `/deals/${deal.id}/activity` },
          { key: 'notes', label: 'Notes', to: `/deals/${deal.id}/notes` },
        ]}
      />

      <div className={styles.tabContent}>
        <Outlet context={{ deal } satisfies { deal: Deal }} />
      </div>
    </div>
  )
}
