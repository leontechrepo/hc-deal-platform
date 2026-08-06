import { useState } from 'react'
import type { Deal } from '../../types'
import { PIPELINE_STAGES } from '../shared/PipelineStageBadge'
import { usePatchDeal } from '../../hooks/useDeals'
import { KanbanColumn } from './KanbanColumn'
import styles from './KanbanBoard.module.css'

interface Props {
  deals: Deal[]
  onEdit: (deal: Deal) => void
  onDelete: (deal: Deal) => void
}

export function KanbanBoard({ deals, onEdit, onDelete }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const patchDeal = usePatchDeal()

  const byStage = new Map<string, Deal[]>()
  for (const stage of PIPELINE_STAGES) byStage.set(stage, [])
  for (const d of deals) {
    if (!d.pipeline_stage) continue
    if (!byStage.has(d.pipeline_stage)) byStage.set(d.pipeline_stage, [])
    byStage.get(d.pipeline_stage)!.push(d)
  }

  function handleDrop(targetStage: string) {
    if (draggingId === null) return
    const deal = deals.find(d => d.id === draggingId)
    setDraggingId(null)
    if (!deal || deal.pipeline_stage === targetStage) return
    patchDeal.mutate({ dealId: deal.id, field: 'pipeline_stage', value: targetStage })
  }

  return (
    <div className={styles.board}>
      {[...byStage.entries()].map(([stage, stageDeals]) => (
        <KanbanColumn
          key={stage}
          stage={stage}
          deals={stageDeals}
          draggingId={draggingId}
          onDragStart={setDraggingId}
          onDragEnd={() => setDraggingId(null)}
          onDrop={handleDrop}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
