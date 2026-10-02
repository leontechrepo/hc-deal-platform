import { useState } from 'react'

import { formatPipelineStage } from '../../domain/stages'
import { fmtM, sumDealSize } from '../../domain/format'
import type { Deal } from '../../types'
import { KanbanCard } from './KanbanCard'
import styles from './KanbanColumn.module.css'

interface Props {
  stage: string
  deals: Deal[]
  draggingId: string | null
  onDragStart: (dealId: string) => void
  onDragEnd: () => void
  onDrop: (stage: string) => void
  onEdit: (deal: Deal) => void
  onDelete: (deal: Deal) => void
}

export function KanbanColumn({ stage, deals, draggingId, onDragStart, onDragEnd, onDrop, onEdit, onDelete }: Props) {
  const [over, setOver] = useState(false)
  const total = sumDealSize(deals)
  const title = stage === 'unstaged' ? 'No stage' : (formatPipelineStage(stage) ?? stage)

  return (
    <section
      className={[styles.column, over ? styles.over : ''].join(' ')}
      aria-label={title}
      data-stage={stage}
      onDragOver={(e) => {
        // Without preventDefault the browser refuses the drop; gating on
        // draggingId keeps dragged files/text selections from being droppable.
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
      <header className={styles.header}>
        <span className={styles.title}>{title}</span>
        <span className={styles.count}>{deals.length}</span>
      </header>
      {total > 0 && <div className={styles.total}>{fmtM(total, 1)}</div>}
      <div className={styles.cards}>
        {deals.length === 0 ? (
          <div className={styles.empty}>No deals</div>
        ) : (
          deals.map((deal) => (
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
    </section>
  )
}
