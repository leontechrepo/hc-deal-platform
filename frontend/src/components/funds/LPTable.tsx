import { useState } from 'react'
import { DataTable, type Column } from '../ui/DataTable/DataTable'
import { Button } from '../ui/Button/Button'
import { LPFormModal } from './LPFormModal'
import { useCreateLP, useDeleteLP, useUpdateLP } from '../../hooks/useFunds'
import { useToast } from '../Toast/Toast'
import type { FundLP, FundLPInput } from '../../types'
import styles from './LPTable.module.css'

interface Props {
  fundId: number
  lps: FundLP[]
}

function fmtM(value: number | null): string {
  return value === null ? '—' : `$${value.toFixed(1)}M`
}

export function LPTable({ fundId, lps }: Props) {
  const createLP = useCreateLP()
  const updateLP = useUpdateLP()
  const deleteLP = useDeleteLP()
  const { showToast } = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<FundLP | null>(null)

  async function handleDelete(lp: FundLP) {
    if (!window.confirm(`Remove LP "${lp.name}"?`)) return
    try {
      await deleteLP.mutateAsync({ fundId, lpId: lp.id })
      showToast('LP removed')
    } catch {
      showToast('Remove failed', true)
    }
  }

  async function handleSubmit(body: FundLPInput) {
    if (editing) {
      await updateLP.mutateAsync({ fundId, lpId: editing.id, body })
      showToast('LP updated')
    } else {
      await createLP.mutateAsync({ fundId, body })
      showToast('LP added')
    }
  }

  const columns: Column<FundLP>[] = [
    { key: 'name', header: 'LP Name', render: lp => lp.name },
    { key: 'commitment_m', header: 'Commitment', render: lp => fmtM(lp.commitment_m), mono: true },
    { key: 'called_m', header: 'Called', render: lp => fmtM(lp.called_m), mono: true },
    {
      key: 'called_pct',
      header: '% Called',
      render: lp => lp.commitment_m && lp.called_m ? `${((lp.called_m / lp.commitment_m) * 100).toFixed(0)}%` : '—',
      mono: true,
    },
    {
      key: 'actions',
      header: '',
      render: lp => (
        <div className={styles.rowActions}>
          <button className={styles.linkBtn} onClick={() => { setEditing(lp); setModalOpen(true) }}>Edit</button>
          <button className={styles.linkBtn} onClick={() => handleDelete(lp)}>Remove</button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className={styles.header}>
        <span className={styles.title}>Limited Partners</span>
        <Button variant="secondary" onClick={() => { setEditing(null); setModalOpen(true) }}>Add LP</Button>
      </div>
      <DataTable columns={columns} rows={lps} rowKey={lp => lp.id} emptyMessage="No LPs recorded yet." />
      <LPFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={editing}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
