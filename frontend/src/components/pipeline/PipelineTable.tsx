import { Link } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'

import { PIPELINE_STAGES, formatPipelineStage } from '../../domain/stages'
import { fmtM, parseLocalDate, sumDealSize } from '../../domain/format'
import type { Deal } from '../../types'
import { CountBadge } from '../ui/CountBadge'
import { DataTable, type Column } from '../ui/DataTable/DataTable'
import { StatusBadge } from '../shared/StatusBadge'
import styles from './PipelineTable.module.css'

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
        <span className={styles.size}>{deal.deal_size_m ? fmtM(deal.deal_size_m, 1) : <span className={styles.dim}>TBD</span>}</span>
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
    { key: 'status', header: 'Status', render: (deal) => <StatusBadge status={deal.status} /> },
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
          <button type="button" className={styles.iconBtn} onClick={() => onEdit(deal)} title="Edit deal" aria-label={`Edit ${deal.company_name}`}>
            <Pencil size={14} />
          </button>
          <button type="button" className={styles.iconBtn} onClick={() => onDelete(deal)} title="Delete deal" aria-label={`Delete ${deal.company_name}`}>
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

/**
 * The same deals as the board, grouped into one panel per stage in funnel
 * order. A deal with no stage gets its own group rather than disappearing.
 */
export function PipelineTable({ deals, onEdit, onDelete }: Props) {
  const byStage = new Map<string, Deal[]>()
  for (const d of deals) {
    const s = d.pipeline_stage ?? 'unstaged'
    if (!byStage.has(s)) byStage.set(s, [])
    byStage.get(s)!.push(d)
  }

  const known = PIPELINE_STAGES.filter((s) => byStage.has(s)) as string[]
  const rest = [...byStage.keys()].filter((s) => !known.includes(s))
  const columns = buildColumns(onEdit, onDelete)

  return (
    <div className={styles.stack}>
      {[...known, ...rest].map((stage) => {
        const rows = byStage.get(stage)!
        const total = sumDealSize(rows)
        return (
          <section key={stage} className={`table-card ${styles.section}`} aria-label={formatPipelineStage(stage) ?? 'No stage'}>
            <div className={styles.stageHeader}>
              <span className={styles.stageTitle}>{stage === 'unstaged' ? 'No stage' : (formatPipelineStage(stage) ?? stage)}</span>
              <CountBadge count={rows.length} />
              <div className={styles.spacer} />
              {total > 0 && <span className={styles.total}>{fmtM(total, 1)}</span>}
            </div>
            <DataTable columns={columns} rows={rows} rowKey={(deal) => deal.id} />
          </section>
        )
      })}
    </div>
  )
}
