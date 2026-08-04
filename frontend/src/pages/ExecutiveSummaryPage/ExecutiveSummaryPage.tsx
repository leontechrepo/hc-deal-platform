import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDeals } from '../../hooks/useDeals'
import { usePortfolio } from '../../hooks/usePortfolio'
import { useInbox } from '../../hooks/useInbox'
import { DataTable, type Column } from '../../components/ui/DataTable/DataTable'
import { KPIGrid } from '../../components/ui/KPIGrid/KPIGrid'
import { PageShell } from '../../components/ui/PageShell/PageShell'
import { PIPELINE_STAGES, formatPipelineStage } from '../../components/shared/PipelineStageBadge'
import { PipelineStageGroup } from '../../components/shared/PipelineStageGroup'
import { TableCard } from '../../components/shared/TableCard'
import type { Deal } from '../../types'
import styles from './ExecutiveSummaryPage.module.css'

function fmtM(value: number | null): string {
  return value === null ? '—' : `$${value}M`
}

function fmtSumM(sum: number): string {
  return `$${sum.toFixed(1)}M`
}

function fmtX(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(2)}x`
}

// Financial terms (leverage/rate/DSCR/risk) are only meaningful once a deal has an LOI —
// showing them for earlier-stage deals is just noise, since they're always null.
const EARLY_STAGES = new Set(['sourcing', 'intake_triage', 'nda_execution', 'screening'])

const companyColumn: Column<Deal> = {
  key: 'company',
  header: 'Company',
  render: (deal) => <Link to={`/deals/${deal.id}`} className={styles.companyLink}>{deal.company_name}</Link>,
}
const facilityColumn: Column<Deal> = {
  key: 'facility',
  header: 'Facility',
  mono: true,
  render: (deal) => fmtM(deal.deal_size_m),
}
const nextActionColumn: Column<Deal> = {
  key: 'nextAction',
  header: 'Next Action',
  width: 200,
  render: (deal) => deal.next_action ?? <span className={styles.dim}>—</span>,
}

const leanColumns: Column<Deal>[] = [companyColumn, facilityColumn, nextActionColumn]

const fullColumns: Column<Deal>[] = [
  companyColumn,
  facilityColumn,
  { key: 'hold', header: 'Hold', mono: true, render: (deal) => fmtM(deal.hold_amount_m) },
  { key: 'leverage', header: 'Leverage', mono: true, render: (deal) => fmtX(deal.total_leverage) },
  {
    key: 'rate',
    header: 'Rate',
    mono: true,
    render: (deal) => (deal.all_in_rate === null ? '—' : `${deal.all_in_rate.toFixed(2)}%`),
  },
  {
    key: 'dscr',
    header: 'DSCR',
    mono: true,
    render: (deal) => (
      <span className={deal.dscr !== null && deal.dscr < 1.25 ? styles.riskLow : undefined}>
        {fmtX(deal.dscr)}
      </span>
    ),
  },
  {
    key: 'risk',
    header: 'Risk',
    mono: true,
    render: (deal) => (deal.risk_score === null ? '—' : `${deal.risk_score}/100`),
  },
  nextActionColumn,
]

interface StageGroup {
  stage: string
  label: string
  deals: Deal[]
}

// Advanced stages (post pre-LOI) first, most-advanced first; early/low-signal stages last — both descending by
// pipeline progression so the closest-to-close deals surface at the top and the big early-stage bucket sinks to the bottom.
function groupByStage(deals: Deal[]): StageGroup[] {
  const byStage = new Map<string, Deal[]>()
  for (const d of deals) {
    if (!d.pipeline_stage) continue
    if (!byStage.has(d.pipeline_stage)) byStage.set(d.pipeline_stage, [])
    byStage.get(d.pipeline_stage)!.push(d)
  }

  const stagesWithDeals = PIPELINE_STAGES.filter(stage => (byStage.get(stage)?.length ?? 0) > 0)
  const advanced = stagesWithDeals.filter(stage => !EARLY_STAGES.has(stage)).reverse()
  const early = stagesWithDeals.filter(stage => EARLY_STAGES.has(stage)).reverse()

  return [...advanced, ...early].map(stage => ({
    stage,
    label: formatPipelineStage(stage) ?? stage,
    deals: byStage.get(stage)!,
  }))
}

const SHELL = { title: 'Executive Summary', sub: 'Corporate Credit — Portfolio brief' }

export function ExecutiveSummaryPage() {
  const { data: deals = [], isLoading: dealsLoading, isError: dealsError } = useDeals()
  const { data: positions = [], isLoading: portfolioLoading, isError: portfolioError } = usePortfolio()
  const { data: inboxItems = [], isLoading: inboxLoading, isError: inboxError } = useInbox()

  const activeDeals = useMemo(() => deals.filter(d => d.status === 'Active'), [deals])
  const stageGroups = useMemo(() => groupByStage(activeDeals), [activeDeals])

  // Default-open state is a pure function of the stage (advanced = open, early = collapsed); only
  // explicit user toggles are tracked here, so it's unaffected by when async deal data arrives.
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({})
  function isStageOpen(stage: string): boolean {
    return stage in openOverrides ? openOverrides[stage] : !EARLY_STAGES.has(stage)
  }
  function toggleStage(stage: string) {
    setOpenOverrides(prev => ({ ...prev, [stage]: !isStageOpen(stage) }))
  }

  const kpiItems = useMemo(() => [
    { label: 'Active Deals', value: activeDeals.length },
    { label: 'Total Pipeline', value: fmtSumM(activeDeals.reduce((sum, d) => sum + (d.deal_size_m ?? 0), 0)) },
    { label: 'Total Hold', value: fmtSumM(activeDeals.reduce((sum, d) => sum + (d.hold_amount_m ?? 0), 0)) },
    { label: 'Portfolio', value: fmtSumM(positions.reduce((sum, p) => sum + (p.current_balance_m ?? 0), 0)) },
    { label: 'Inbox', value: inboxItems.length },
  ], [activeDeals, positions, inboxItems])

  const isLoading = dealsLoading || portfolioLoading || inboxLoading
  const isError = dealsError || portfolioError || inboxError

  if (isLoading) return <PageShell {...SHELL}><div className={styles.state}>Loading executive summary…</div></PageShell>
  if (isError) return <PageShell {...SHELL}><div className={styles.state}>Failed to load executive summary.</div></PageShell>

  return (
    <PageShell {...SHELL}>
      <KPIGrid items={kpiItems} />

      <TableCard title="Active Pipeline — By Stage">
        {stageGroups.length === 0 ? (
          <div className={styles.state}>No active deals.</div>
        ) : (
          stageGroups.map(group => {
            const open = isStageOpen(group.stage)
            const isEarly = EARLY_STAGES.has(group.stage)
            return (
              <PipelineStageGroup
                key={group.stage}
                label={group.label}
                count={group.deals.length}
                totalM={group.deals.reduce((sum, d) => sum + (d.deal_size_m ?? 0), 0)}
                open={open}
                onToggle={() => toggleStage(group.stage)}
              >
                <DataTable
                  columns={isEarly ? leanColumns : fullColumns}
                  rows={group.deals}
                  rowKey={(deal) => deal.id}
                />
              </PipelineStageGroup>
            )
          })
        )}
      </TableCard>
    </PageShell>
  )
}
