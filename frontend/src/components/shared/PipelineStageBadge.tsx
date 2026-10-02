import { stageTone } from '../../domain/badgeTones'
import { formatPipelineStage } from '../../domain/stages'
import { TonedBadge } from '../ui/TonedBadge'

export function PipelineStageBadge({ stage }: { stage: string | null }) {
  if (!stage) return null
  return <TonedBadge tone={stageTone(stage)}>{formatPipelineStage(stage)}</TonedBadge>
}
