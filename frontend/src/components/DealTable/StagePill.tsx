import { Badge, type BadgeTone } from '../ui/Badge/Badge'

const STAGE_TONE: Record<string, BadgeTone> = {
  'Closed':                'green',
  'Pre-LOI Diligence':     'blue',
  'Initial Conversations': 'purple',
  'On Hold':                'yellow',
  'Passed':                'red',
}

interface Props {
  stage: string | null
}

export function StagePill({ stage }: Props) {
  if (!stage) return null
  const tone = STAGE_TONE[stage] ?? 'gray'
  return <Badge tone={tone}>{stage}</Badge>
}
