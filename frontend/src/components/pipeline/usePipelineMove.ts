import { useState } from 'react'

import { useToast } from '../Toast/Toast'
import { usePatchDeal } from '../../hooks/useDeals'
import { classifyMove, formatPipelineStage } from '../../domain/stages'
import type { Deal } from '../../types'

export interface PendingSkip {
  dealId: string
  companyName: string
  fromStage: string | null
  toStage: string
  skipped: string[]
}

/**
 * Moving a deal between funnel stages (drag-and-drop or table action).
 *
 * A forward jump of two or more stages needs a recorded reason, surfaced as a
 * prompt *before* the request. Single steps and backward moves go straight
 * through: deals really do fall back, and making that awkward just teaches
 * people to leave the stage wrong.
 */
export function usePipelineMove() {
  const patchDeal = usePatchDeal()
  const { showToast } = useToast()
  const [pending, setPending] = useState<PendingSkip | null>(null)

  function commit(dealId: string, companyName: string, toStage: string, reasoning?: string) {
    patchDeal.mutate(
      { dealId, field: 'pipeline_stage', value: toStage, reasoning },
      {
        onSuccess: () => showToast(`${companyName} moved to ${formatPipelineStage(toStage) ?? toStage}`),
        onError: () => showToast(`Couldn't move ${companyName}`, true),
      },
    )
  }

  function moveDeal(deal: Deal, toStage: string) {
    const move = classifyMove(deal.pipeline_stage, toStage)
    if (move.kind === 'same') return
    if (move.kind === 'skip') {
      setPending({
        dealId: deal.id,
        companyName: deal.company_name,
        fromStage: deal.pipeline_stage,
        toStage,
        skipped: move.skipped,
      })
      return
    }
    commit(deal.id, deal.company_name, toStage)
  }

  function confirmWithReason(reasoning: string) {
    if (!pending) return
    commit(pending.dealId, pending.companyName, pending.toStage, reasoning)
    setPending(null)
  }

  return {
    moveDeal,
    pending,
    confirmWithReason,
    dismissPending: () => setPending(null),
    isMoving: patchDeal.isPending,
  }
}
