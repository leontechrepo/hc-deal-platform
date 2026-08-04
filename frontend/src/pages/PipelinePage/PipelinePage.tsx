import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { KPIStrip } from '../../components/KPIStrip/KPIStrip'
import { PipelineTable } from '../../components/pipeline/PipelineTable'
import { KanbanBoard } from '../../components/pipeline/KanbanBoard'
import { ViewToggle, type View } from '../../components/pipeline/ViewToggle'
import { DealFormModal } from '../../components/pipeline/DealFormModal'
import { Button } from '../../components/ui/Button/Button'
import { PageShell } from '../../components/ui/PageShell/PageShell'
import { Tabs } from '../../components/ui/Tabs/Tabs'
import { STATUSES } from '../../components/shared/StatusBadge'
import { useToast } from '../../components/Toast/Toast'
import { useKPIs } from '../../hooks/useKPIs'
import { useCreateDeal, useDeals, useDeleteDeal, useUpdateDeal } from '../../hooks/useDeals'
import type { CreateDealInput, Deal } from '../../types'
import styles from './PipelinePage.module.css'

const STATUS_TABS = ['Active', ...STATUSES.filter(s => s !== 'Active'), 'All'] as const
type StatusTab = (typeof STATUS_TABS)[number]

export function PipelinePage() {
  const [activeStatus, setActiveStatus] = useState<StatusTab>('Active')
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: kpis } = useKPIs()
  const { data: deals = [], isLoading } = useDeals()
  const createDeal = useCreateDeal()
  const updateDeal = useUpdateDeal()
  const deleteDeal = useDeleteDeal()
  const { showToast } = useToast()

  const view: View = searchParams.get('view') === 'kanban' ? 'kanban' : 'table'
  const [modalOpen, setModalOpen] = useState(searchParams.get('new') === '1')
  const [editing, setEditing] = useState<Deal | null>(null)

  function setView(next: View) {
    const params = new URLSearchParams(searchParams)
    if (next === 'table') params.delete('view')
    else params.set('view', next)
    setSearchParams(params, { replace: true })
  }

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(deal: Deal) {
    setEditing(deal)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    const params = new URLSearchParams(searchParams)
    params.delete('new')
    setSearchParams(params, { replace: true })
  }

  async function handleSubmit(body: Partial<CreateDealInput>) {
    if (editing) {
      await updateDeal.mutateAsync({ dealId: editing.id, body })
    } else {
      await createDeal.mutateAsync(body as CreateDealInput)
    }
  }

  async function handleDelete(deal: Deal) {
    if (!window.confirm(`Delete deal "${deal.company_name}"? This cannot be undone.`)) return
    try {
      await deleteDeal.mutateAsync(deal.id)
      showToast('Deal deleted')
    } catch {
      showToast('Delete failed', true)
    }
  }

  const visibleDeals = activeStatus === 'All' ? deals : deals.filter(d => d.status === activeStatus)

  return (
    <PageShell
      title="Pipeline"
      sub="Corporate Credit — Deal Pipeline · Confidential"
    >
      {kpis && <KPIStrip kpis={kpis} />}

      <div className={styles.toolbar}>
        <Tabs
          items={STATUS_TABS.map(tab => ({ key: tab, label: tab }))}
          activeKey={activeStatus}
          onChange={key => setActiveStatus(key as StatusTab)}
        />
        <div className={styles.toolbarActions}>
          <ViewToggle view={view} onChange={setView} />
          <Button variant="primary" onClick={openCreate}>+ New Deal</Button>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.loading}>Loading deals…</div>
      ) : view === 'kanban' ? (
        <KanbanBoard deals={visibleDeals} onEdit={openEdit} onDelete={handleDelete} />
      ) : (
        <PipelineTable deals={visibleDeals} onEdit={openEdit} onDelete={handleDelete} />
      )}

      <DealFormModal open={modalOpen} onClose={closeModal} initial={editing} onSubmit={handleSubmit} />
    </PageShell>
  )
}
