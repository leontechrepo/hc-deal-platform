import { useMemo, useState } from 'react'
import { useCreateFund, useDeleteFund, useFunds, useUpdateFund } from '../../hooks/useFunds'
import { FundCard } from '../../components/funds/FundCard'
import { FundFormModal } from '../../components/funds/FundFormModal'
import { Button } from '../../components/ui/Button/Button'
import { EmptyState } from '../../components/ui/EmptyState/EmptyState'
import { KPIGrid } from '../../components/ui/KPIGrid/KPIGrid'
import { PageHeader } from '../../components/ui/PageHeader/PageHeader'
import { useToast } from '../../components/Toast/Toast'
import type { Fund, FundInput } from '../../types'
import styles from './FundsPage.module.css'

export function FundsPage() {
  const { data: funds = [], isLoading, isError } = useFunds()
  const createFund = useCreateFund()
  const updateFund = useUpdateFund()
  const deleteFund = useDeleteFund()
  const { showToast } = useToast()

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Fund | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return funds
    return funds.filter(f =>
      f.name.toLowerCase().includes(q) || (f.strategy ?? '').toLowerCase().includes(q)
    )
  }, [funds, search])

  const kpiItems = useMemo(() => {
    const totalCommitted = funds.reduce((sum, f) => sum + (f.total_commitment_m ?? 0), 0)
    const totalDeployed = funds.reduce((sum, f) => sum + (f.deployed_capital_m ?? 0), 0)
    const leverages = funds.map(f => f.target_leverage).filter((v): v is number => v !== null)
    const avgLeverage = leverages.length ? leverages.reduce((a, b) => a + b, 0) / leverages.length : 0
    return [
      { label: 'Total Funds', value: funds.length },
      { label: 'Total Committed', value: `$${totalCommitted.toFixed(0)}M` },
      { label: 'Total Deployed', value: `$${totalDeployed.toFixed(0)}M` },
      { label: 'Avg Target Leverage', value: leverages.length ? `${avgLeverage.toFixed(2)}x` : '—' },
    ]
  }, [funds])

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(fund: Fund) {
    setEditing(fund)
    setModalOpen(true)
  }

  async function handleSubmit(body: Partial<FundInput>) {
    if (editing) {
      await updateFund.mutateAsync({ id: editing.id, body })
      showToast('Fund updated')
    } else {
      await createFund.mutateAsync(body)
      showToast('Fund created')
    }
  }

  async function handleDelete(fund: Fund) {
    if (!window.confirm(`Delete fund "${fund.name}"? This cannot be undone.`)) return
    try {
      await deleteFund.mutateAsync(fund.id)
      showToast('Fund deleted')
    } catch {
      showToast('Delete failed', true)
    }
  }

  if (isLoading) return <div className={styles.state}>Loading funds…</div>
  if (isError) return <div className={styles.state}>Failed to load funds.</div>

  return (
    <div className={styles.page}>
      <PageHeader title="Funds" />

      <KPIGrid items={kpiItems} />

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder="Search funds…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Button variant="primary" onClick={openCreate}>New Fund</Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No funds yet"
          description="Add your first fund."
          action={<Button variant="primary" onClick={openCreate}>New Fund</Button>}
        />
      ) : (
        <div className={styles.grid}>
          {filtered.map(fund => (
            <FundCard
              key={fund.id}
              fund={fund}
              onEdit={() => openEdit(fund)}
              onDelete={() => handleDelete(fund)}
            />
          ))}
        </div>
      )}

      <FundFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={editing}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
