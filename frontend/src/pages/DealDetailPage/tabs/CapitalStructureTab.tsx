import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  useCreateParticipantLender, useCreateTranche, useDeleteParticipantLender, useDeleteTranche,
  useParticipantLenders, useTranches, useUpdateParticipantLender, useUpdateTranche,
} from '../../../hooks/useCapitalStructure'
import { useCovenants, useCreateCovenant, useUpdateCovenant } from '../../../hooks/useCovenants'
import { TrancheFormModal } from '../../../components/capitalstructure/TrancheFormModal'
import { ParticipantLenderFormModal } from '../../../components/capitalstructure/ParticipantLenderFormModal'
import { CovenantFormModal } from '../../../components/capitalstructure/CovenantFormModal'
import { Button } from '../../../components/ui/Button/Button'
import { EmptyState } from '../../../components/ui/EmptyState/EmptyState'
import { DataTable, type Column } from '../../../components/ui/DataTable/DataTable'
import { useToast } from '../../../components/Toast/Toast'
import type {
  CapitalStructureTranche, CapitalStructureTrancheInput, Covenant, CovenantInput, CovenantPatchInput,
  Deal, ParticipantLender, ParticipantLenderInput,
} from '../../../types'
import styles from './CapitalStructureTab.module.css'

function fmtCents(cents: number | null): string {
  if (cents === null) return '—'
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

export function CapitalStructureTab() {
  const { deal } = useOutletContext<{ deal: Deal }>()
  const { showToast } = useToast()

  const { data: tranches = [], isLoading: tranchesLoading, isError: tranchesError } = useTranches(deal.id)
  const createTranche = useCreateTranche(deal.id)
  const updateTranche = useUpdateTranche(deal.id)
  const deleteTranche = useDeleteTranche(deal.id)
  const [trancheModalOpen, setTrancheModalOpen] = useState(false)
  const [editingTranche, setEditingTranche] = useState<CapitalStructureTranche | null>(null)

  const { data: lenders = [], isLoading: lendersLoading, isError: lendersError } = useParticipantLenders(deal.id)
  const createLender = useCreateParticipantLender(deal.id)
  const updateLender = useUpdateParticipantLender(deal.id)
  const deleteLender = useDeleteParticipantLender(deal.id)
  const [lenderModalOpen, setLenderModalOpen] = useState(false)
  const [editingLender, setEditingLender] = useState<ParticipantLender | null>(null)

  const { data: covenants = [], isLoading: covenantsLoading, isError: covenantsError } = useCovenants(deal.id)
  const createCovenant = useCreateCovenant(deal.id)
  const updateCovenant = useUpdateCovenant(deal.id)
  const [covenantModalOpen, setCovenantModalOpen] = useState(false)
  const [editingCovenant, setEditingCovenant] = useState<Covenant | null>(null)

  function openCreateTranche() {
    setEditingTranche(null)
    setTrancheModalOpen(true)
  }
  function openEditTranche(t: CapitalStructureTranche) {
    setEditingTranche(t)
    setTrancheModalOpen(true)
  }
  async function submitTranche(body: Partial<CapitalStructureTrancheInput>) {
    if (editingTranche) {
      await updateTranche.mutateAsync({ trancheId: editingTranche.tranche_id, body })
      showToast('Tranche updated')
    } else {
      await createTranche.mutateAsync(body)
      showToast('Tranche added')
    }
  }
  async function removeTranche(t: CapitalStructureTranche) {
    if (!window.confirm(`Remove ${t.tranche_type || 'this'} tranche?`)) return
    try {
      await deleteTranche.mutateAsync(t.tranche_id)
      showToast('Tranche removed')
    } catch {
      showToast('Remove failed', true)
    }
  }

  function openCreateLender() {
    setEditingLender(null)
    setLenderModalOpen(true)
  }
  function openEditLender(l: ParticipantLender) {
    setEditingLender(l)
    setLenderModalOpen(true)
  }
  async function submitLender(body: Partial<ParticipantLenderInput>) {
    if (editingLender) {
      await updateLender.mutateAsync({ participantId: editingLender.participant_id, body })
      showToast('Lender updated')
    } else {
      await createLender.mutateAsync(body)
      showToast('Lender added')
    }
  }
  async function removeLender(l: ParticipantLender) {
    if (!window.confirm(`Remove lender "${l.lender_name}"?`)) return
    try {
      await deleteLender.mutateAsync(l.participant_id)
      showToast('Lender removed')
    } catch {
      showToast('Remove failed', true)
    }
  }

  function openCreateCovenant() {
    setEditingCovenant(null)
    setCovenantModalOpen(true)
  }
  function openEditCovenant(c: Covenant) {
    setEditingCovenant(c)
    setCovenantModalOpen(true)
  }
  async function submitCovenant(body: Partial<CovenantInput> | CovenantPatchInput) {
    if (editingCovenant) {
      await updateCovenant.mutateAsync({ covenantId: editingCovenant.covenant_id, body: body as CovenantPatchInput })
      showToast('Covenant updated')
    } else {
      await createCovenant.mutateAsync(body as Partial<CovenantInput>)
      showToast('Covenant added')
    }
  }

  const trancheColumns: Column<CapitalStructureTranche>[] = [
    { key: 'tranche_type', header: 'Type', render: t => t.tranche_type || '—' },
    { key: 'holder', header: 'Holder', render: t => t.holder || '—' },
    { key: 'amount', header: 'Amount', render: t => fmtCents(t.amount), mono: true },
    { key: 'seniority_rank', header: 'Seniority', render: t => t.seniority_rank ?? '—', mono: true },
    { key: 'is_lcg_position', header: 'LCG Position', render: t => t.is_lcg_position ? 'Yes' : 'No' },
    {
      key: 'actions',
      header: '',
      render: t => (
        <div className={styles.rowActions}>
          <Button variant="ghost" size="sm" onClick={() => openEditTranche(t)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => removeTranche(t)}>Remove</Button>
        </div>
      ),
    },
  ]

  const lenderColumns: Column<ParticipantLender>[] = [
    { key: 'lender_name', header: 'Lender', render: l => l.lender_name },
    { key: 'participation_amount', header: 'Participation', render: l => fmtCents(l.participation_amount), mono: true },
    { key: 'is_agent', header: 'Agent', render: l => l.is_agent ? 'Yes' : 'No' },
    {
      key: 'actions',
      header: '',
      render: l => (
        <div className={styles.rowActions}>
          <Button variant="ghost" size="sm" onClick={() => openEditLender(l)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => removeLender(l)}>Remove</Button>
        </div>
      ),
    },
  ]

  const covenantColumns: Column<Covenant>[] = [
    { key: 'covenant_type', header: 'Type', render: c => c.covenant_type },
    { key: 'covenant_name', header: 'Name', render: c => c.covenant_name },
    { key: 'threshold_value', header: 'Threshold', render: c => c.threshold_value ?? '—', mono: true },
    { key: 'test_frequency', header: 'Test Frequency', render: c => c.test_frequency || '—' },
    {
      key: 'actions',
      header: '',
      render: c => <Button variant="ghost" size="sm" onClick={() => openEditCovenant(c)}>Edit</Button>,
    },
  ]

  return (
    <div className={styles.tab}>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Tranches</h2>
          <Button variant="secondary" size="sm" onClick={openCreateTranche}>Add Tranche</Button>
        </div>
        {tranchesLoading ? (
          <div className={styles.state}>Loading tranches…</div>
        ) : tranchesError ? (
          <div className={styles.state}>Failed to load tranches.</div>
        ) : tranches.length === 0 ? (
          <EmptyState title="No tranches yet" description="Break down the capital structure by tranche." />
        ) : (
          <DataTable columns={trancheColumns} rows={tranches} rowKey={t => t.tranche_id} />
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Participant Lenders</h2>
          <Button variant="secondary" size="sm" onClick={openCreateLender}>Add Lender</Button>
        </div>
        {lendersLoading ? (
          <div className={styles.state}>Loading lenders…</div>
        ) : lendersError ? (
          <div className={styles.state}>Failed to load lenders.</div>
        ) : lenders.length === 0 ? (
          <EmptyState title="No participant lenders yet" description="Add syndicate participants for this deal." />
        ) : (
          <DataTable columns={lenderColumns} rows={lenders} rowKey={l => l.participant_id} />
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Covenants</h2>
          <Button variant="secondary" size="sm" onClick={openCreateCovenant}>Add Covenant</Button>
        </div>
        {covenantsLoading ? (
          <div className={styles.state}>Loading covenants…</div>
        ) : covenantsError ? (
          <div className={styles.state}>Failed to load covenants.</div>
        ) : covenants.length === 0 ? (
          <EmptyState title="No covenants yet" description="Define financial, negative, or affirmative covenants." />
        ) : (
          <DataTable columns={covenantColumns} rows={covenants} rowKey={c => c.covenant_id} />
        )}
      </section>

      <TrancheFormModal
        open={trancheModalOpen}
        onClose={() => setTrancheModalOpen(false)}
        initial={editingTranche}
        onSubmit={submitTranche}
      />
      <ParticipantLenderFormModal
        open={lenderModalOpen}
        onClose={() => setLenderModalOpen(false)}
        initial={editingLender}
        onSubmit={submitLender}
      />
      <CovenantFormModal
        open={covenantModalOpen}
        onClose={() => setCovenantModalOpen(false)}
        initial={editingCovenant}
        onSubmit={submitCovenant}
      />
    </div>
  )
}
