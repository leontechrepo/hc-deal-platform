import { Card } from '../ui/Card/Card'
import { Badge } from '../ui/Badge/Badge'
import { KPIGrid } from '../ui/KPIGrid/KPIGrid'
import { ProgressBar } from '../ui/ProgressBar/ProgressBar'
import { PipelineDealsMiniTable } from '../shared/PipelineDealsMiniTable'
import { LPTable } from './LPTable'
import type { Fund } from '../../types'
import styles from './FundCard.module.css'

interface Props {
  fund: Fund
  onEdit: () => void
  onDelete: () => void
}

export function FundCard({ fund, onEdit, onDelete }: Props) {
  const items = [
    { label: 'Total Commitment', value: fund.total_commitment_m !== null ? `$${fund.total_commitment_m.toFixed(0)}M` : '—' },
    { label: 'Called', value: fund.called_capital_m !== null ? `$${fund.called_capital_m.toFixed(0)}M` : '—' },
    { label: 'Deployed', value: fund.deployed_capital_m !== null ? `$${fund.deployed_capital_m.toFixed(0)}M` : '—' },
    { label: 'Available', value: fund.available_capital_m !== null ? `$${fund.available_capital_m.toFixed(0)}M` : '—' },
  ]

  const deploymentPct = fund.total_commitment_m
    ? ((fund.deployed_capital_m ?? 0) / fund.total_commitment_m) * 100
    : 0

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.name}>{fund.name}</span>
          {fund.status && <Badge tone={fund.status === 'Investing' ? 'green' : 'gold'}>{fund.status}</Badge>}
        </div>
        <div className={styles.headerActions}>
          <button className={styles.iconBtn} onClick={onEdit} title="Edit fund">Edit</button>
          <button className={styles.iconBtn} onClick={onDelete} title="Delete fund">Delete</button>
        </div>
      </div>

      <KPIGrid items={items} />

      <div className={styles.progressSection}>
        <div className={styles.progressLabel}>
          <span>Deployed</span>
          <span>{deploymentPct.toFixed(0)}%</span>
        </div>
        <ProgressBar value={deploymentPct} tone="green" />
      </div>

      <div className={styles.details}>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Vintage</span>
          <span className={styles.detailValue}>{fund.vintage || '—'}</span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Strategy</span>
          <span className={styles.detailValue}>{fund.strategy || '—'}</span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Target Return</span>
          <span className={styles.detailValue}>{fund.target_return || '—'}</span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Target Leverage</span>
          <span className={styles.detailValue}>{fund.target_leverage !== null ? `${fund.target_leverage.toFixed(2)}x` : '—'}</span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>GP Commitment</span>
          <span className={styles.detailValue}>{fund.gp_commitment_m !== null ? `$${fund.gp_commitment_m.toFixed(1)}M` : '—'}</span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Mgmt Fee / Carry</span>
          <span className={styles.detailValue}>
            {fund.mgmt_fee_pct !== null ? `${fund.mgmt_fee_pct.toFixed(2)}%` : '—'} / {fund.carried_interest_pct !== null ? `${fund.carried_interest_pct.toFixed(2)}%` : '—'}
          </span>
        </div>
      </div>

      {fund.focus_sectors && fund.focus_sectors.length > 0 && (
        <div className={styles.sectors}>
          {fund.focus_sectors.map(s => <Badge key={s} tone="blue">{s}</Badge>)}
        </div>
      )}

      <div className={styles.section}>
        <LPTable fundId={fund.id} lps={fund.lps} />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Deals</div>
        <PipelineDealsMiniTable deals={fund.deals} showHoldAmount />
      </div>
    </Card>
  )
}
