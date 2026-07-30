import { useMemo, useState } from 'react'
import { usePortfolio } from '../../hooks/usePortfolio'
import { DataTable, type Column } from '../../components/ui/DataTable/DataTable'
import { Modal } from '../../components/ui/Modal/Modal'
import { EmptyState } from '../../components/ui/EmptyState/EmptyState'
import { KPIGrid } from '../../components/ui/KPIGrid/KPIGrid'
import { PaymentStatusBadge, RiskBadge } from '../../components/portfolio/PortfolioBadges'
import { MonitoringTestDrawer } from '../../components/portfolio/MonitoringTestDrawer'
import type { PortfolioPosition } from '../../types'
import styles from './PortfolioPage.module.css'

function fmtM(value: number | null): string {
  return value === null ? '—' : `$${value.toFixed(2)}M`
}

function fmtX(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(2)}x`
}

function isPastDueOrSoon(dateStr: string | null): boolean {
  if (!dateStr) return false
  const days = (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return days <= 30
}

export function PortfolioPage() {
  const { data: positions = [], isLoading, isError } = usePortfolio()
  const [selectedDealId, setSelectedDealId] = useState<number | null>(null)

  const selectedPosition = useMemo(
    () => positions.find(p => p.deal_id === selectedDealId) ?? null,
    [positions, selectedDealId]
  )

  const kpiItems = useMemo(() => [
    { label: 'Positions', value: positions.length },
    { label: 'Total Outstanding', value: `$${positions.reduce((sum, p) => sum + (p.current_balance_m ?? 0), 0).toFixed(1)}M` },
    { label: 'At Risk (Watch)', value: positions.filter(p => p.risk === 'Watch').length },
    { label: 'Past Due', value: positions.filter(p => p.payment_status && p.payment_status !== 'Current').length },
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
    { key: 'original_amount_m', header: 'Original', render: p => fmtM(p.original_amount_m), mono: true },
    { key: 'current_balance_m', header: 'Balance', render: p => fmtM(p.current_balance_m), mono: true },
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
    { key: 'covenant_status', header: 'Covenant', render: p => p.covenant_status || '—' },
    { key: 'leverage', header: 'Leverage', render: p => fmtX(p.leverage), mono: true },
    { key: 'dscr', header: 'DSCR', render: p => fmtX(p.dscr), mono: true },
    {
      key: 'actions',
      header: '',
      render: p => (
        <button className={styles.viewTestsBtn} onClick={() => setSelectedDealId(p.deal_id)}>View Tests</button>
      ),
    },
  ]

  if (isLoading) return <div className={styles.state}>Loading portfolio…</div>
  if (isError) return <div className={styles.state}>Failed to load portfolio.</div>

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.eyebrow}>LHP Private Credit — Deal Platform</div>
        <h1 className={styles.title}>Portfolio</h1>
      </header>

      <KPIGrid items={kpiItems} />

      {positions.length === 0 ? (
        <EmptyState
          title="No portfolio positions yet"
          description="Positions appear here once a deal reaches Portfolio Monitoring."
        />
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
    </div>
  )
}
