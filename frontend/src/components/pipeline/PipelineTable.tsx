import { Link } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import type { Deal } from '../../types'
import { DataTable, type Column } from '../ui/DataTable/DataTable'
import { PipelineStageBadge, PIPELINE_STAGES } from '../shared/PipelineStageBadge'
import { StatusBadge } from '../shared/StatusBadge'
import styles from './PipelineTable.module.css'

function parseLocalDate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function buildColumns(onEdit: (deal: Deal) => void, onDelete: (deal: Deal) => void): Column<Deal>[] {
  return [
    {
      key: 'company',
      header: 'Company / Location',
      render: (deal) => (
        <>
          <Link to={`/deals/${deal.id}`} className={styles.companyName}>{deal.company_name}</Link>
          <span className={styles.companyMeta}>
            {[deal.sector_primary, deal.location].filter(Boolean).join(' · ')}
            {deal.last_updated && (
              <> · {parseLocalDate(deal.last_updated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
            )}
          </span>
        </>
      ),
    },
    {
      key: 'size',
      header: 'Size ($M)',
      mono: true,
      render: (deal) => (
        <span className={styles.size}>
          {deal.deal_size_m ? `$${deal.deal_size_m}M` : <span className={styles.dim}>TBD</span>}
        </span>
      ),
    },
    {
      key: 'sector',
      header: 'Sector',
      render: (deal) => (
        <>
          {deal.sector_primary ?? <span className={styles.dim}>—</span>}
          {deal.subsector && <div className={styles.subsector}>{deal.subsector}</div>}
        </>
      ),
    },
    {
      key: 'security',
      header: 'Security',
      render: (deal) => deal.security ?? <span className={styles.dim}>—</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (deal) => <StatusBadge status={deal.status} />,
    },
    {
      key: 'commentary',
      header: 'Commentary / Next Steps',
      width: 200,
      render: (deal) => deal.commentary ?? <span className={styles.dim}>—</span>,
    },
    {
      key: 'actions',
      header: '',
      width: 72,
      render: (deal) => (
        <div className={styles.rowActions}>
          <button type="button" className={styles.iconBtn} onClick={() => onEdit(deal)} title="Edit deal">
            <Pencil size={14} />
          </button>
          <button type="button" className={styles.iconBtn} onClick={() => onDelete(deal)} title="Delete deal">
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ]
}

interface Props {
  deals: Deal[]
  onEdit: (deal: Deal) => void
  onDelete: (deal: Deal) => void
}

export function PipelineTable({ deals, onEdit, onDelete }: Props) {
  if (deals.length === 0) {
    return <div className={styles.empty}>No deals match this filter.</div>
  }

  const byStage = new Map<string, Deal[]>()
  for (const d of deals) {
    const s = d.pipeline_stage ?? 'Unknown'
    if (!byStage.has(s)) byStage.set(s, [])
    byStage.get(s)!.push(d)
  }

  const stages = [
    ...PIPELINE_STAGES.filter(s => byStage.has(s)),
    ...[...byStage.keys()].filter(s => !(PIPELINE_STAGES as readonly string[]).includes(s)),
  ]

  const columns = buildColumns(onEdit, onDelete)

  return (
    <div>
      {stages.map(stage => (
        <div key={stage} className={styles.section}>
          <div className={styles.stageHeader}>
            <PipelineStageBadge stage={stage} />
            <span className={styles.dealCount}>
              {byStage.get(stage)!.length} deal{byStage.get(stage)!.length !== 1 ? 's' : ''}
            </span>
          </div>
          <DataTable columns={columns} rows={byStage.get(stage)!} rowKey={(deal) => deal.id} />
        </div>
      ))}
    </div>
  )
}
