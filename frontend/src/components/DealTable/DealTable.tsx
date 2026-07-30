import type { Deal } from '../../types'
import { InlineEdit } from './InlineEdit'
import { ProcessDots } from './ProcessDots'
import { StagePill } from './StagePill'
import { DataTable, type Column } from '../ui/DataTable/DataTable'
import styles from './DealTable.module.css'

function parseLocalDate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const STAGE_ORDER = [
  'Closed',
  'Pre-LOI Diligence',
  'Initial Conversations',
  'On Hold',
  'Passed',
]

interface Props {
  deals: Deal[]
  showStage?: boolean  // reserved for future use (All Active tab)
}

const columns: Column<Deal>[] = [
  {
    key: 'company',
    header: 'Company / Location',
    render: (deal) => (
      <>
        <span className={styles.companyName}>{deal.company_name}</span>
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
        <InlineEdit dealId={deal.id} field="sector_primary" value={deal.sector_primary} />
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
    key: 'process',
    header: 'Process',
    render: (deal) => <ProcessDots deal={deal} />,
  },
  {
    key: 'commentary',
    header: 'Commentary / Next Steps',
    width: 200,
    render: (deal) => <InlineEdit dealId={deal.id} field="commentary" value={deal.commentary} multiline />,
  },
]

export function DealTable({ deals, showStage: _showStage = false }: Props) {
  if (deals.length === 0) {
    return <div className={styles.empty}>No deals in this bucket.</div>
  }

  // Group by stage
  const byStage = new Map<string, Deal[]>()
  for (const d of deals) {
    const s = d.stage ?? 'Unknown'
    if (!byStage.has(s)) byStage.set(s, [])
    byStage.get(s)!.push(d)
  }

  const stages = [
    ...STAGE_ORDER.filter(s => byStage.has(s)),
    ...[...byStage.keys()].filter(s => !STAGE_ORDER.includes(s)),
  ]

  return (
    <div>
      {stages.map(stage => (
        <div key={stage} className={styles.section}>
          <div className={styles.stageHeader}>
            <StagePill stage={stage} />
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
