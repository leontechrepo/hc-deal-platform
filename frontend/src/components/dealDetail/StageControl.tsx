import { useState } from 'react'
import { Field, FieldLabel } from '@leontechrepo/leon-ui'

import { usePatchDeal } from '../../hooks/useDeals'
import { useCurrentActor } from '../../hooks/useCurrentActor'
import { useToast } from '../Toast/Toast'
import { SkipReasonPrompt } from '../pipeline/SkipReasonPrompt'
import { ReasonPrompt } from '../pipeline/ReasonPrompt'
import { SelectInput } from '../ui/Form/Form'
import {
  PIPELINE_STAGES,
  STATUSES,
  classifyMove,
  formatPipelineStage,
  statusNeedsReason,
} from '../../domain/stages'
import type { Deal } from '../../types'
import styles from './StageControl.module.css'

type Pending =
  | { field: 'pipeline_stage'; value: string; skipped: string[] }
  | { field: 'status'; value: string }
  | null

/**
 * Moving a deal through the funnel and ending its life.
 *
 * Both of the server's "give me a reason" rules are surfaced before the request:
 * a forward jump of two or more stages and a move to a terminal status each need
 * a recorded reason. Backward moves are deliberately frictionless.
 */
export function StageControl({ deal, disabled }: { deal: Deal; disabled?: boolean }) {
  const patch = usePatchDeal()
  const actor = useCurrentActor()
  const { showToast } = useToast()
  const [pending, setPending] = useState<Pending>(null)

  async function save(field: string, value: string, reasoning?: string) {
    try {
      await patch.mutateAsync({ dealId: deal.id, field, value, actor, reasoning })
      showToast('Saved')
      return true
    } catch {
      showToast('Save failed', true)
      return false
    }
  }

  async function onStageChange(target: string) {
    const move = classifyMove(deal.pipeline_stage, target)
    if (move.kind === 'same') return
    if (move.kind === 'skip') {
      setPending({ field: 'pipeline_stage', value: target, skipped: move.skipped })
      return
    }
    await save('pipeline_stage', target)
  }

  async function onStatusChange(target: string) {
    if (target === deal.status) return
    if (statusNeedsReason(target)) {
      setPending({ field: 'status', value: target })
      return
    }
    await save('status', target)
  }

  async function confirm(reasoning: string) {
    if (!pending) return
    if (await save(pending.field, pending.value, reasoning)) setPending(null)
  }

  const busy = disabled || patch.isPending

  return (
    <div className={styles.control}>
      <Field className={styles.field}>
        <FieldLabel htmlFor="deal-stage-select">Stage</FieldLabel>
        <SelectInput
          id="deal-stage-select"
          value={deal.pipeline_stage ?? ''}
          disabled={busy}
          onChange={(e) => void onStageChange(e.target.value)}
        >
          {deal.pipeline_stage === null && <option value="" disabled>—</option>}
          {PIPELINE_STAGES.map((s) => (
            <option key={s} value={s}>
              {formatPipelineStage(s)}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field className={styles.field}>
        <FieldLabel htmlFor="deal-status-select">Status</FieldLabel>
        <SelectInput
          id="deal-status-select"
          value={deal.status ?? ''}
          disabled={busy}
          onChange={(e) => void onStatusChange(e.target.value)}
        >
          {deal.status === null && <option value="" disabled>—</option>}
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </SelectInput>
      </Field>

      {pending && (
        <div className={styles.prompt}>
          {pending.field === 'pipeline_stage' ? (
            <SkipReasonPrompt
              name={deal.company_name}
              toStage={pending.value}
              skipped={pending.skipped}
              busy={busy}
              onCancel={() => setPending(null)}
              onConfirm={(r) => void confirm(r)}
            />
          ) : (
            <ReasonPrompt
              title={`Marking this deal ${pending.value}`}
              description={`${pending.value} ends this deal's active life. The reason is written to the approval log alongside who decided it.`}
              placeholder="Why?"
              confirmLabel="Record and move"
              busy={busy}
              onCancel={() => setPending(null)}
              onConfirm={(r) => void confirm(r)}
            />
          )}
        </div>
      )}
    </div>
  )
}
