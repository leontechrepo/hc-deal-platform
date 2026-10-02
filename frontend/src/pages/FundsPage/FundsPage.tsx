import { useMemo, useState } from 'react'
import { useCreateFund, useDeleteFund, useFunds, useUpdateFund } from '../../hooks/useFunds'
import { FundCard } from '../../components/funds/FundCard'
import { FundFormModal } from '../../components/funds/FundFormModal'
import { Plus, Landmark } from 'lucide-react'
import { Button, EmptyState } from '@leontechrepo/leon-ui'
import { KpiItems } from '../../components/ui/Kpi'
import { SearchBox } from '../../components/ui/SearchBox'
import { PageError, PageLoading } from '../../components/ui/PageState'
import { PageActions } from '../../components/shell/PageActions'
import { useToast } from '../../components/Toast/Toast'
import type { Fund, FundInput } from '../../types'
import styles from './FundsPage.module.css'

export function FundsPage() {
  const { data: funds = [], isLoading, isError, refetch } = useFunds()
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

  if (isLoading) return <PageLoading label="Loading funds…" />
  if (isError) return <PageError title="Couldn't load funds" onRetry={() => void refetch()} />

  const newFund = (
    <Button size="sm" onClick={openCreate}>
      <Plus size={14} strokeWidth={2.05} />
      New Fund
    </Button>
  )

  return (
    <>
      <PageActions>{newFund}</PageActions>
      <KpiItems items={kpiItems} />

      <div className={styles.toolbar}>
        <SearchBox value={search} onChange={setSearch} placeholder="Search funds…" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Landmark} title={funds.length === 0 ? 'No funds yet' : 'No funds match'} action={funds.length === 0 ? newFund : undefined}>
          {funds.length === 0 ? 'Add your first fund.' : 'Try a different search.'}
        </EmptyState>
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
    </>
  )
}
