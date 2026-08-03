import { Link } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import type { Deal } from '../../types'
import { StatusBadge } from '../shared/StatusBadge'
import styles from './KanbanCard.module.css'

interface Props {
  deal: Deal
  onDragStart: (dealId: number) => void
  onDragEnd: () => void
  onEdit: (deal: Deal) => void
  onDelete: (deal: Deal) => void
}

export function KanbanCard({ deal, onDragStart, onDragEnd, onEdit, onDelete }: Props) {
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
      <div className={styles.cardHeader}>
        <Link to={`/deals/${deal.id}`} className={styles.company}>{deal.company_name}</Link>
        <div className={styles.cardActions}>
          <button
            type="button"
            className={styles.iconBtn}
            draggable
            onDragStart={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onEdit(deal) }}
            title="Edit deal"
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            draggable
            onDragStart={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(deal) }}
            title="Delete deal"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
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
