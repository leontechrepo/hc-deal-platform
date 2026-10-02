import { useState } from 'react'

import { PIPELINE_STAGES } from '../../domain/stages'
import type { Deal } from '../../types'
import { KanbanColumn } from './KanbanColumn'
import { SkipReasonPrompt } from './SkipReasonPrompt'
import { usePipelineMove } from './usePipelineMove'
import styles from './KanbanBoard.module.css'

export const UNSTAGED = 'unstaged'

interface Props {
  deals: Deal[]
  onEdit: (deal: Deal) => void
  onDelete: (deal: Deal) => void
}

/**
 * The funnel as columns, one per credit stage (all 11, in order, even when
 * empty). Drag is native HTML5. A deal with no stage gets a trailing column
 * rather than vanishing.
 */
export function KanbanBoard({ deals, onEdit, onDelete }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const { moveDeal, pending, confirmWithReason, dismissPending, isMoving } = usePipelineMove()

  const byStage = new Map<string, Deal[]>()
  for (const stage of PIPELINE_STAGES) byStage.set(stage, [])
  for (const d of deals) {
    const key = d.pipeline_stage ?? UNSTAGED
    if (!byStage.has(key)) byStage.set(key, [])
    byStage.get(key)!.push(d)
  }
  if (byStage.get(UNSTAGED)?.length === 0) byStage.delete(UNSTAGED)

  function handleDrop(targetStage: string) {
    const deal = deals.find((d) => d.id === draggingId)
    setDraggingId(null)
    if (!deal || targetStage === UNSTAGED || deal.pipeline_stage === targetStage) return
    moveDeal(deal, targetStage)
  }

  return (
    <>
      {pending && (
        <SkipReasonPrompt
          name={pending.companyName}
          toStage={pending.toStage}
          skipped={pending.skipped}
          busy={isMoving}
          onCancel={dismissPending}
          onConfirm={confirmWithReason}
        />
      )}
      <div className={styles.board} data-testid="kanban-board">
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
    </>
  )
}
