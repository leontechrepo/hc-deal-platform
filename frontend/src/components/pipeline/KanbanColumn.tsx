import { useState } from 'react'
import type { Deal } from '../../types'
import { formatPipelineStage } from '../shared/PipelineStageBadge'
import { KanbanCard } from './KanbanCard'
import styles from './KanbanColumn.module.css'

interface Props {
  stage: string
  deals: Deal[]
  draggingId: number | null
  onDragStart: (dealId: number) => void
  onDragEnd: () => void
  onDrop: (stage: string) => void
  onEdit: (deal: Deal) => void
  onDelete: (deal: Deal) => void
}

export function KanbanColumn({ stage, deals, draggingId, onDragStart, onDragEnd, onDrop, onEdit, onDelete }: Props) {
  const [over, setOver] = useState(false)

  return (
    <div
      className={[styles.column, over ? styles.over : ''].join(' ')}
      onDragOver={(e) => {
        if (draggingId === null) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        onDrop(stage)
      }}
    >
      <div className={styles.header}>
        <span className={styles.title}>{formatPipelineStage(stage)}</span>
        <span className={styles.count}>{deals.length}</span>
      </div>
      <div className={styles.cards}>
        {deals.length === 0 ? (
          <div className={styles.empty}>No deals</div>
        ) : (
          deals.map(deal => (
            <KanbanCard
              key={deal.id}
              deal={deal}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}
