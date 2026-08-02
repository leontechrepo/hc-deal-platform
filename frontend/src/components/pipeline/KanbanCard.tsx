import { Link } from 'react-router-dom'
import type { Deal } from '../../types'
import { StatusBadge } from '../shared/StatusBadge'
import styles from './KanbanCard.module.css'

interface Props {
  deal: Deal
  onDragStart: (dealId: number) => void
  onDragEnd: () => void
}

export function KanbanCard({ deal, onDragStart, onDragEnd }: Props) {
  return (
    <div
      className={styles.card}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(deal.id)
      }}
      onDragEnd={onDragEnd}
    >
      <Link to={`/deals/${deal.id}`} className={styles.company}>{deal.company_name}</Link>
      <div className={styles.meta}>
        {[deal.sector_primary, deal.location].filter(Boolean).join(' · ') || '—'}
      </div>
      <div className={styles.footer}>
        <span className={styles.size}>
          {deal.deal_size_m ? `$${deal.deal_size_m}M` : <span className={styles.dim}>TBD</span>}
        </span>
        <StatusBadge status={deal.status} />
      </div>
    </div>
  )
}
