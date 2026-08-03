import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useDeals } from '../../hooks/useDeals'
import { usePortfolio } from '../../hooks/usePortfolio'
import { useInbox } from '../../hooks/useInbox'
import { DataTable, type Column } from '../../components/ui/DataTable/DataTable'
import { KPIGrid } from '../../components/ui/KPIGrid/KPIGrid'
import { PageShell } from '../../components/ui/PageShell/PageShell'
import { PipelineStageBadge } from '../../components/shared/PipelineStageBadge'
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

const columns: Column<Deal>[] = [
  {
    key: 'company',
    header: 'Company',
    render: (deal) => <Link to={`/deals/${deal.id}`} className={styles.companyLink}>{deal.company_name}</Link>,
  },
  {
    key: 'stage',
    header: 'Stage',
    render: (deal) => <PipelineStageBadge stage={deal.pipeline_stage} />,
  },
  { key: 'facility', header: 'Facility', mono: true, render: (deal) => fmtM(deal.deal_size_m) },
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
  {
    key: 'nextAction',
    header: 'Next Action',
    width: 200,
    render: (deal) => deal.next_action ?? <span className={styles.dim}>—</span>,
  },
]

const SHELL = { title: 'Executive Summary', sub: 'LHP Private Credit — Portfolio brief' }

export function ExecutiveSummaryPage() {
  const { data: deals = [], isLoading: dealsLoading, isError: dealsError } = useDeals()
  const { data: positions = [], isLoading: portfolioLoading, isError: portfolioError } = usePortfolio()
  const { data: inboxItems = [], isLoading: inboxLoading, isError: inboxError } = useInbox()

  const activeDeals = useMemo(() => deals.filter(d => d.status === 'Active'), [deals])

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

      <TableCard title="Active Pipeline — One Line Per Deal">
        <DataTable columns={columns} rows={activeDeals} rowKey={(deal) => deal.id} emptyMessage="No active deals." />
      </TableCard>
    </PageShell>
  )
}
