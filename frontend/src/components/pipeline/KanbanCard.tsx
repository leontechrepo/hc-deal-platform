import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'

import { fmtM } from '../../domain/format'
import type { Deal } from '../../types'
import { StatusBadge } from '../shared/StatusBadge'
import styles from './KanbanCard.module.css'

interface Props {
  deal: Deal
  onDragStart: (dealId: string) => void
  onDragEnd: () => void
  onEdit: (deal: Deal) => void
  onDelete: (deal: Deal) => void
}

/**
 * A deal on the board: what it is, where, how big and what state. The stage is
 * the column, so the card never repeats it. The name is a real link so the card
 * stays keyboard-reachable even though it is a drag source.
 */
export function KanbanCard({ deal, onDragStart, onDragEnd, onEdit, onDelete }: Props) {
  const [dragging, setDragging] = useState(false)

  return (
    <article
      className={[styles.card, dragging ? styles.dragging : ''].join(' ')}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        setDragging(true)
        onDragStart(deal.id)
      }}
      onDragEnd={() => {
        setDragging(false)
        onDragEnd()
      }}
    >
      <div className={styles.cardHeader}>
        <Link to={`/deals/${deal.id}`} className={styles.company} draggable={false}>
          {deal.company_name}
        </Link>
        <div className={styles.cardActions}>
          <button type="button" className={styles.iconBtn} onClick={() => onEdit(deal)} title="Edit deal" aria-label={`Edit ${deal.company_name}`}>
            <Pencil size={12} />
          </button>
          <button type="button" className={styles.iconBtn} onClick={() => onDelete(deal)} title="Delete deal" aria-label={`Delete ${deal.company_name}`}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      <div className={styles.meta}>{[deal.sector_primary, deal.location].filter(Boolean).join(' · ') || '—'}</div>
      <div className={styles.footer}>
        <span className={styles.size}>{deal.deal_size_m ? fmtM(deal.deal_size_m, 1) : <span className={styles.dim}>TBD</span>}</span>
        <StatusBadge status={deal.status} />
      </div>
    </article>
  )
}
