import { formatPipelineStage } from '../../domain/stages'
import { ReasonPrompt } from './ReasonPrompt'

/**
 * The reason prompt a multi-stage forward jump demands. Shared by the Kanban
 * board and the deal-detail stage control: same rule, same wording.
 */
export function SkipReasonPrompt({
  name,
  toStage,
  skipped,
  busy,
  onCancel,
  onConfirm,
}: {
  name: string
  toStage: string
  skipped: string[]
  busy?: boolean
  onCancel: () => void
  onConfirm: (reasoning: string) => void
}) {
  const n = skipped.length
  return (
    <ReasonPrompt
      title={`${name}: skipping ${n} stage${n === 1 ? '' : 's'}`}
      description={`Deals normally move one stage at a time. Going straight to ${formatPipelineStage(toStage)} skips ${skipped
        .map((s) => formatPipelineStage(s))
        .join(', ')}. The reason is recorded against the deal.`}
      placeholder="Why is this deal skipping ahead?"
      confirmLabel="Record and move"
      busy={busy}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}
