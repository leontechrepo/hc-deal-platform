import type { Deal } from '../../types'

function parseLocalDate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
import { InlineEdit } from './InlineEdit'
import { ProcessDots } from './ProcessDots'
import { StagePill } from './StagePill'
import styles from './DealTable.module.css'

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
            <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>
              {byStage.get(stage)!.length} deal{byStage.get(stage)!.length !== 1 ? 's' : ''}
            </span>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Company / Location</th>
                <th>Size ($M)</th>
                <th>Sector</th>
                <th>Security</th>
                <th>Process</th>
                <th style={{ minWidth: 200 }}>Commentary / Next Steps</th>
              </tr>
            </thead>
            <tbody>
              {byStage.get(stage)!.map(deal => (
                <tr key={deal.id}>
                  <td>
                    <span className={styles.companyName}>{deal.company_name}</span>
                    <span className={styles.companyMeta}>
                      {[deal.sector_primary, deal.location].filter(Boolean).join(' · ')}
                      {deal.last_updated && (
                        <> · {parseLocalDate(deal.last_updated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>
                      )}
                    </span>
                  </td>
                  <td className={styles.size}>
                    {deal.deal_size_m ? `$${deal.deal_size_m}M` : <span style={{ color: 'var(--gray-400)' }}>TBD</span>}
                  </td>
                  <td>
                    <InlineEdit dealId={deal.id} field="sector_primary" value={deal.sector_primary} />
                    {deal.subsector && (
                      <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{deal.subsector}</div>
                    )}
                  </td>
                  <td>{deal.security ?? <span style={{ color: 'var(--gray-400)' }}>—</span>}</td>
                  <td><ProcessDots deal={deal} /></td>
                  <td>
                    <InlineEdit dealId={deal.id} field="commentary" value={deal.commentary} multiline />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
