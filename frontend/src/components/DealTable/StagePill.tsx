const STAGE_STYLES: Record<string, { bg: string; fg: string }> = {
  'Closed':                { bg: 'var(--green-bg)', fg: 'var(--green)' },
  'Pre-LOI Diligence':     { bg: 'var(--blue-bg)', fg: 'var(--blue-fg)' },
  'Initial Conversations': { bg: 'var(--purple-bg)', fg: 'var(--purple-fg)' },
  'On Hold':               { bg: 'var(--yellow-bg)', fg: 'var(--yellow-fg)' },
  'Passed':                { bg: 'var(--red-bg)', fg: 'var(--red-fg)' },
}

interface Props {
  stage: string | null
}

export function StagePill({ stage }: Props) {
  if (!stage) return null
  const s = STAGE_STYLES[stage] ?? { bg: 'var(--gray-100)', fg: 'var(--gray-400)' }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 500,
      background: s.bg,
      color: s.fg,
      whiteSpace: 'nowrap',
    }}>
      {stage}
    </span>
  )
}
