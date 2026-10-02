import { useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { Button, DetailHeader, EmptyState, Kpi, KpiGrid, Tabs } from '@leontechrepo/leon-ui'
import { useDeal, useDeleteDeal, useUpdateDeal } from '../../hooks/useDeals'
import { PipelineStageBadge } from '../../components/shared/PipelineStageBadge'
import { StatusBadge } from '../../components/shared/StatusBadge'
import { StageTracker } from '../../components/shared/StageTracker'
import { StageControl } from '../../components/dealDetail/StageControl'
import { DealFormModal } from '../../components/pipeline/DealFormModal'
import { LoadingBlock } from '../../components/ui/Skeleton/Skeleton'
import { useToast } from '../../components/Toast/Toast'
import { fmtM, fmtPct, fmtX } from '../../domain/format'
import { DealProvider } from './dealContext'
import { OverviewTab } from './tabs/OverviewTab'
import { UnderwritingTab } from './tabs/UnderwritingTab'
import { TimelineTab } from './tabs/TimelineTab'
import { FormulasTab } from './tabs/FormulasTab'
import { ActivityTab } from './tabs/ActivityTab'
import { NotesTab } from './tabs/NotesTab'
import { DocumentsTab } from './tabs/DocumentsTab'
import { TeamTab } from './tabs/TeamTab'
import { CapitalStructureTab } from './tabs/CapitalStructureTab'
import type { CreateDealInput } from '../../types'
import styles from './DealDetailPage.module.css'

const TAB_KEYS = [
  'overview',
  'team',
  'capital-structure',
  'underwriting',
  'timeline',
  'formulas',
  'activity',
  'notes',
  'documents',
] as const

type TabKey = (typeof TAB_KEYS)[number]

const TAB_ITEMS = [
  { value: 'overview', label: 'Overview' },
  { value: 'team', label: 'Team & Contacts' },
  { value: 'capital-structure', label: 'Capital Structure' },
  { value: 'underwriting', label: 'Underwriting' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'formulas', label: 'Formulas' },
  { value: 'activity', label: 'Activity' },
  { value: 'notes', label: 'Notes' },
  { value: 'documents', label: 'Documents' },
]

function isTabKey(value: string): value is TabKey {
  return (TAB_KEYS as readonly string[]).includes(value)
}

/** Redirect legacy `/deals/:id/overview` paths to `?tab=`. */
export function LegacyDealTabRedirect() {
  const { dealId, legacyTab } = useParams<{ dealId: string; legacyTab: string }>()
  const tab = legacyTab && isTabKey(legacyTab) ? legacyTab : 'overview'
  return <Navigate to={`/deals/${dealId}?tab=${tab}`} replace />
}

export function DealDetailPage() {
  const { dealId } = useParams<{ dealId: string }>()
  const { data: deal, isLoading, isError, refetch } = useDeal(dealId ?? null)
  const updateDeal = useUpdateDeal()
  const deleteDeal = useDeleteDeal()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [editOpen, setEditOpen] = useState(false)
  const [params, setParams] = useSearchParams()
  const rawTab = params.get('tab') ?? 'overview'
  const tab: TabKey = isTabKey(rawTab) ? rawTab : 'overview'

  const back = (
    <Link to="/pipeline" className={styles.backLink}>
      <ArrowLeft size={15} strokeWidth={2.05} />
      Pipeline
    </Link>
  )

  if (isLoading) {
    return (
      <>
        {back}
        <LoadingBlock label="Loading deal…" lines={5} />
      </>
    )
  }
  if (isError || !deal) {
    return (
      <>
        {back}
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load this deal"
          action={
            <Button size="sm" variant="secondary" onClick={() => void refetch()}>
              Try again
            </Button>
          }
        >
          The deal may have been deleted, or the server is unreachable.
        </EmptyState>
      </>
    )
  }

  async function handleUpdate(body: Partial<CreateDealInput> & { reasoning?: string }) {
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

  function setTab(next: string) {
    const nextParams = new URLSearchParams(params)
    if (next === 'overview') nextParams.delete('tab')
    else nextParams.set('tab', next)
    setParams(nextParams, { replace: true })
  }

  return (
    <DealProvider deal={deal}>
      <DetailHeader
        back={back}
        title={deal.company_name}
        meta={
          <>
            <PipelineStageBadge stage={deal.pipeline_stage} />
            <StatusBadge status={deal.status} />
            <span>{deal.sector_primary ?? 'Corporate Credit'}</span>
          </>
        }
        actions={
          <div className={styles.actions}>
            <StageControl deal={deal} />
            <div className={styles.actionButtons}>
              <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil size={13} strokeWidth={2.05} />
                Edit
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 size={13} strokeWidth={2.05} />
                Delete
              </Button>
            </div>
          </div>
        }
      />

      <KpiGrid>
        <Kpi label="Deal Size" value={fmtM(deal.deal_size_m)} />
        <Kpi label="Total Leverage" value={fmtX(deal.total_leverage)} />
        <Kpi label="All-In Rate" value={fmtPct(deal.all_in_rate)} />
        <Kpi label="Risk Score" value={deal.risk_score !== null ? deal.risk_score.toFixed(1) : '—'} />
      </KpiGrid>

      <StageTracker currentStage={deal.pipeline_stage} />

      <Tabs items={TAB_ITEMS} value={tab} onValueChange={setTab} aria-label="Deal sections" />

      <div className={styles.tabContent}>
        <TabBody tab={tab} />
      </div>

      <DealFormModal open={editOpen} onClose={() => setEditOpen(false)} initial={deal} onSubmit={handleUpdate} />
    </DealProvider>
  )
}

function TabBody({ tab }: { tab: TabKey }): ReactNode {
  switch (tab) {
    case 'overview':
      return <OverviewTab />
    case 'team':
      return <TeamTab />
    case 'capital-structure':
      return <CapitalStructureTab />
    case 'underwriting':
      return <UnderwritingTab />
    case 'timeline':
      return <TimelineTab />
    case 'formulas':
      return <FormulasTab />
    case 'activity':
      return <ActivityTab />
    case 'notes':
      return <NotesTab />
    case 'documents':
      return <DocumentsTab />
  }
}
