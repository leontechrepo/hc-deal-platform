import { CONFIDENCE_HELP, confidenceBand } from './inboxCopy'
import { TonedBadge } from '../ui/TonedBadge'

export function ConfidenceChip({ value, scope }: { value: number | null; scope?: string }) {
  if (value === null) return null
  const band = confidenceBand(value)
  const { label, meaning } = CONFIDENCE_HELP[band]
  const tone = band === 'stated' ? 'navy' : band === 'inferred' ? 'gray' : 'amber'
  const pct = Math.round(value * 100)
  return (
    <span
      title={`${label} — ${meaning} (model confidence ${pct}%${scope ? `, ${scope}` : ''})`}
      aria-label={`Confidence: ${label}, ${pct}%`}
    >
      <TonedBadge tone={tone}>{label}</TonedBadge>
    </span>
  )
}
