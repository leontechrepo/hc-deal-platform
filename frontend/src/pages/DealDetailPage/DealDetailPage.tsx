import { useState } from 'react'
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom'
import { useDeal, useDeleteDeal, useUpdateDeal } from '../../hooks/useDeals'
import { KPIGrid } from '../../components/ui/KPIGrid/KPIGrid'
import { PageShell } from '../../components/ui/PageShell/PageShell'
import { Tabs } from '../../components/ui/Tabs/Tabs'
import { Button } from '../../components/ui/Button/Button'
import { PipelineStageBadge } from '../../components/shared/PipelineStageBadge'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { StageTracker } from '../../components/shared/StageTracker'
import { DealFormModal } from '../../components/pipeline/DealFormModal'
import { useToast } from '../../components/Toast/Toast'
import type { CreateDealInput, Deal } from '../../types'
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
  const updateDeal = useUpdateDeal()
  const deleteDeal = useDeleteDeal()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [editOpen, setEditOpen] = useState(false)

  if (isLoading) {
    return <PageShell title="Deal"><div className={styles.state}>Loading deal…</div></PageShell>
  }
  if (isError || !deal) {
    return <PageShell title="Deal"><div className={styles.state}>Failed to load deal.</div></PageShell>
  }

  async function handleUpdate(body: Partial<CreateDealInput>) {
    await updateDeal.mutateAsync({ dealId: deal!.id, body })
  }

  async function handleDelete() {
    if (!window.confirm(`Delete deal "${deal!.company_name}"? This cannot be undone.`)) return
    try {
      await deleteDeal.mutateAsync(deal!.id)
      showToast('Deal deleted')
      navigate('/pipeline')
    } catch {
      showToast('Delete failed', true)
    }
  }

  const kpiItems = [
    { label: 'Deal Size', value: fmtM(deal.deal_size_m) },
    { label: 'Total Leverage', value: fmtX(deal.total_leverage) },
    { label: 'All-In Rate', value: deal.all_in_rate !== null ? `${deal.all_in_rate.toFixed(2)}%` : '—' },
    { label: 'Risk Score', value: deal.risk_score !== null ? deal.risk_score.toFixed(1) : '—' },
  ]

  return (
    <PageShell
      title={deal.company_name}
      sub={deal.sector_primary ?? 'Corporate Credit — Deal Detail'}
      actions={
        <>
          <PipelineStageBadge stage={deal.pipeline_stage} />
          <StatusBadge status={deal.status} />
          <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>Edit</Button>
          <Button variant="danger" size="sm" onClick={handleDelete}>Delete</Button>
        </>
      }
    >
      <Link to="/pipeline" className={styles.backLink}>← Pipeline</Link>

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
          { key: 'documents', label: 'Documents', to: `/deals/${deal.id}/documents` },
        ]}
      />

      <div className={styles.tabContent}>
        <Outlet context={{ deal } satisfies { deal: Deal }} />
      </div>

      <DealFormModal open={editOpen} onClose={() => setEditOpen(false)} initial={deal} onSubmit={handleUpdate} />
    </PageShell>
  )
}
