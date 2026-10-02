import { useMemo, useState } from 'react'
import { usePortfolio } from '../../hooks/usePortfolio'
import { Building2 } from 'lucide-react'
import { Button, EmptyState } from '@leontechrepo/leon-ui'
import { DataTable, type Column } from '../../components/ui/DataTable/DataTable'
import { Modal } from '../../components/ui/Modal/Modal'
import { KpiItems } from '../../components/ui/Kpi'
import { PageError, PageLoading } from '../../components/ui/PageState'
import { TonedBadge } from '../../components/ui/TonedBadge'
import { covenantStatusTone } from '../../domain/badgeTones'
import { fmtM as fmtMoney, fmtX } from '../../domain/format'
import { PaymentStatusBadge, RiskBadge } from '../../components/portfolio/PortfolioBadges'
import { MonitoringTestDrawer } from '../../components/portfolio/MonitoringTestDrawer'
import type { PortfolioPosition } from '../../types'
import styles from './PortfolioPage.module.css'

function isPastDueOrSoon(dateStr: string | null): boolean {
  if (!dateStr) return false
  const days = (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return days <= 30
}

export function PortfolioPage() {
  const { data: positions = [], isLoading, isError, refetch } = usePortfolio()
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null)

  const selectedPosition = useMemo(
    () => positions.find(p => p.deal_id === selectedDealId) ?? null,
    [positions, selectedDealId]
  )

  const kpiItems = useMemo(() => [
    { label: 'Positions', value: positions.length, tone: 'navy' as const },
    { label: 'Total Outstanding', value: `$${positions.reduce((sum, p) => sum + (p.current_balance_m ?? 0), 0).toFixed(1)}M` },
    { label: 'At Risk (Watch)', value: positions.filter(p => p.risk === 'Watch').length, tone: 'red' as const },
    { label: 'Past Due', value: positions.filter(p => p.payment_status && p.payment_status !== 'Current').length, tone: 'red' as const },
  ], [positions])

  const columns: Column<PortfolioPosition>[] = [
    {
      key: 'company',
      header: 'Company',
      render: p => (
        <div>
          <div>{p.company_name}</div>
          {p.sponsor_name && <div className={styles.sponsorName}>{p.sponsor_name}</div>}
        </div>
      ),
    },
    { key: 'funded_date', header: 'Funded Date', render: p => p.funded_date || '—' },
    { key: 'original_amount_m', header: 'Original', render: p => fmtMoney(p.original_amount_m), mono: true },
    { key: 'current_balance_m', header: 'Balance', render: p => fmtMoney(p.current_balance_m), mono: true },
    { key: 'rate', header: 'Rate', render: p => p.rate !== null ? `${p.rate.toFixed(2)}%` : '—', mono: true },
    { key: 'payment_status', header: 'Payment', render: p => <PaymentStatusBadge status={p.payment_status} /> },
    { key: 'risk', header: 'Risk', render: p => <RiskBadge risk={p.risk} /> },
    {
      key: 'next_test_date',
      header: 'Next Test',
      render: p => (
        <span className={isPastDueOrSoon(p.next_test_date) ? styles.dueSoon : undefined}>
          {p.next_test_date || '—'}
        </span>
      ),
    },
    { key: 'covenant_status', header: 'Covenant', render: p => p.covenant_status ? <TonedBadge tone={covenantStatusTone(p.covenant_status)}>{p.covenant_status}</TonedBadge> : '—' },
    { key: 'leverage', header: 'Leverage', render: p => fmtX(p.leverage), mono: true },
    { key: 'dscr', header: 'DSCR', render: p => fmtX(p.dscr), mono: true },
    {
      key: 'actions',
      header: '',
      render: p => (
        <Button variant="ghost" size="sm" onClick={() => setSelectedDealId(p.deal_id)}>View Tests</Button>
      ),
    },
  ]

  if (isLoading) return <PageLoading label="Loading portfolio…" />
  if (isError) return <PageError title="Couldn't load the portfolio" onRetry={() => void refetch()} />

  return (
    <>
      <KpiItems items={kpiItems} />

      {positions.length === 0 ? (
        <EmptyState icon={Building2} title="No portfolio positions yet">
          Positions appear here once a deal reaches Portfolio Monitoring.
        </EmptyState>
      ) : (
        <DataTable columns={columns} rows={positions} rowKey={p => p.id} emptyMessage="No portfolio positions yet." />
      )}

      <Modal
        open={selectedPosition !== null}
        onClose={() => setSelectedDealId(null)}
        title={selectedPosition ? `${selectedPosition.company_name} — Monitoring` : undefined}
      >
        {selectedPosition && <MonitoringTestDrawer position={selectedPosition} />}
      </Modal>
    </>
  )
}
