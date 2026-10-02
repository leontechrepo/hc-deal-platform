import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, Briefcase, Plus, Search } from 'lucide-react'
import {
  Button,
  Card,
  EmptyState,
  Input,
  Kpi,
  KpiGrid,
  ResetViewButton,
  SearchableSelect,
  Tabs,
} from '@leontechrepo/leon-ui'
import { PipelineTable } from '../../components/pipeline/PipelineTable'
import { KanbanBoard } from '../../components/pipeline/KanbanBoard'
import { ViewToggle, type View } from '../../components/pipeline/ViewToggle'
import { DealFormModal } from '../../components/pipeline/DealFormModal'
import { PageActions } from '../../components/shell/PageActions'
import { Skeleton } from '../../components/ui/Skeleton/Skeleton'
import { useToast } from '../../components/Toast/Toast'
import { useKPIs } from '../../hooks/useKPIs'
import { useCreateDeal, useDeals, useDeleteDeal, useUpdateDeal } from '../../hooks/useDeals'
import { STATUSES } from '../../domain/stages'
import { fmtM } from '../../domain/format'
import type { CreateDealInput, Deal } from '../../types'
import { distinctSectors, filterDeals } from './pipelineFilters'
import styles from './PipelinePage.module.css'

const STATUS_TABS = ['Active', ...STATUSES.filter((s) => s !== 'Active'), 'All'] as const
type StatusTab = (typeof STATUS_TABS)[number]

function isStatusTab(value: string): value is StatusTab {
  return (STATUS_TABS as readonly string[]).includes(value)
}

export function PipelinePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: kpis } = useKPIs()
  const { data: deals = [], isLoading, isError, error, refetch } = useDeals()
  const createDeal = useCreateDeal()
  const updateDeal = useUpdateDeal()
  const deleteDeal = useDeleteDeal()
  const { showToast } = useToast()

  const rawStatus = searchParams.get('status') ?? 'Active'
  const activeStatus: StatusTab = isStatusTab(rawStatus) ? rawStatus : 'Active'
  const viewParam = searchParams.get('view')
  const view: View =
    viewParam === 'table' || viewParam === 'kanban' ? viewParam : readViewPreference()
  const query = searchParams.get('q') ?? ''
  const sector = searchParams.get('sector')
  const [modalOpen, setModalOpen] = useState(searchParams.get('new') === '1')
  const [editing, setEditing] = useState<Deal | null>(null)

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams)
    if (value === null || value === '') params.delete(key)
    else params.set(key, value)
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
    setParam('new', null)
  }

  async function handleSubmit(body: Partial<CreateDealInput> & { reasoning?: string }) {
    if (editing) {
      await updateDeal.mutateAsync({ dealId: editing.id, body })
    } else {
      const { reasoning: _reasoning, ...createBody } = body
      void _reasoning
      await createDeal.mutateAsync(createBody as CreateDealInput)
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

  const sectors = useMemo(() => distinctSectors(deals), [deals])
  const visibleDeals = useMemo(
    () => filterDeals(deals, { status: activeStatus, query, sector }),
    [deals, activeStatus, query, sector],
  )
  const countsByStatus = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of deals) m.set(d.status ?? '', (m.get(d.status ?? '') ?? 0) + 1)
    return m
  }, [deals])
  const filtersActive = query.trim() !== '' || sector !== null

  return (
    <>
      <PageActions>
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} strokeWidth={2.05} />
          New Deal
        </Button>
      </PageActions>

      {kpis && (
        <KpiGrid>
          <Kpi label="Total Reviewed" value={kpis.total_reviewed} />
          <Kpi label="Closed Deals" value={kpis.closed} tone="green" />
          <Kpi label="Capital Deployed" value={fmtM(kpis.deployed_m, 1)} tone="navy" />
          <Kpi label="Active Diligence" value={kpis.active_diligence} />
          <Kpi label="Active Discussions" value={kpis.active_discussions} />
          <Kpi label="Passed / Hold" value={kpis.passed} tone="red" />
        </KpiGrid>
      )}

      <Card className={styles.toolbar}>
        <Tabs
          items={STATUS_TABS.map((tab) => ({
            value: tab,
            label: tab,
            count: tab === 'All' ? deals.length : (countsByStatus.get(tab) ?? 0),
          }))}
          value={activeStatus}
          onValueChange={(next) => setParam('status', next === 'Active' ? null : next)}
          aria-label="Deal status"
          className={styles.tabs}
        />
        <div className={styles.filters}>
          <div className={styles.search}>
            <Search size={14} className={styles.searchIcon} aria-hidden="true" />
            <Input
              type="search"
              className={styles.searchInput}
              placeholder="Search company, sector, location…"
              aria-label="Search deals"
              value={query}
              onChange={(e) => setParam('q', e.target.value)}
            />
          </div>
          <div className={styles.sector}>
            <SearchableSelect
              options={sectors.map((s) => ({ id: s, label: s }))}
              value={sector}
              onChange={(v) => setParam('sector', v)}
              placeholder="All sectors"
              noneLabel="All sectors"
            />
          </div>
          <ResetViewButton
            active={filtersActive}
            onReset={() => {
              const params = new URLSearchParams(searchParams)
              params.delete('q')
              params.delete('sector')
              setSearchParams(params, { replace: true })
            }}
          />
          <ViewToggle view={view} onChange={(next) => {
              saveViewPreference(next)
              setParam('view', next)
            }} />
        </div>
      </Card>

      {isLoading ? (
        <PipelineSkeleton view={view} />
      ) : isError ? (
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load the pipeline"
          action={
            <Button size="sm" variant="secondary" onClick={() => void refetch()}>
              Try again
            </Button>
          }
        >
          {error instanceof Error ? error.message : 'Something went wrong while loading deals.'}
        </EmptyState>
      ) : visibleDeals.length === 0 && view === 'table' ? (
        <PipelineEmpty
          hasAnyDeals={deals.length > 0}
          filtersActive={filtersActive}
          status={activeStatus}
          onCreate={openCreate}
        />
      ) : view === 'kanban' ? (
        <KanbanBoard deals={visibleDeals} onEdit={openEdit} onDelete={handleDelete} />
      ) : (
        <PipelineTable deals={visibleDeals} onEdit={openEdit} onDelete={handleDelete} />
      )}

      <DealFormModal open={modalOpen} onClose={closeModal} initial={editing} onSubmit={handleSubmit} />
    </>
  )
}

function PipelineEmpty({
  hasAnyDeals,
  filtersActive,
  status,
  onCreate,
}: {
  hasAnyDeals: boolean
  filtersActive: boolean
  status: string
  onCreate: () => void
}) {
  if (!hasAnyDeals) {
    return (
      <EmptyState
        icon={Briefcase}
        title="No deals yet"
        action={
          <Button size="sm" onClick={onCreate}>
            <Plus size={14} strokeWidth={2.05} />
            New Deal
          </Button>
        }
      >
        Deals arrive when a suggestion is approved in the Inbox, or you can add one directly.
      </EmptyState>
    )
  }
  return (
    <EmptyState icon={Briefcase} title="No deals match">
      {filtersActive
        ? 'No deals match the current search or sector. Reset the filters to see everything.'
        : `Nothing is sitting at ${status}. Another status tab may have what you are looking for.`}
    </EmptyState>
  )
}

const VIEW_PREF_KEY = 'hc-pipeline-view'

/** The board is the default (stage-to-stage comparison); a chosen view is remembered. */
function readViewPreference(): View {
  try {
    return localStorage.getItem(VIEW_PREF_KEY) === 'table' ? 'table' : 'kanban'
  } catch {
    return 'kanban'
  }
}

function saveViewPreference(view: View): void {
  try {
    localStorage.setItem(VIEW_PREF_KEY, view)
  } catch {
    // storage blocked: the URL param still carries the choice
  }
}

function PipelineSkeleton({ view }: { view: View }) {
  return (
    <div className={styles.skeleton} role="status" aria-label="Loading deals">
      {view === 'kanban' ? (
        <div className={styles.skeletonBoard}>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={styles.skeletonColumn}>
              <Skeleton height={14} width="60%" />
              <Skeleton height={64} />
              <Skeleton height={64} />
            </div>
          ))}
        </div>
      ) : (
        <>
          <Skeleton height={16} width="30%" />
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} height={36} />
          ))}
        </>
      )}
      <span className={styles.srOnly}>Loading deals…</span>
    </div>
  )
}
