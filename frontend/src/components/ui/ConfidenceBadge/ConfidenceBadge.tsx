import styles from './ConfidenceBadge.module.css'

export function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null) return null
  const pct = Math.round(confidence * 100)
  const cls = confidence >= 0.85 ? styles.high : confidence >= 0.7 ? styles.med : styles.low
  return <span className={`${styles.badge} ${cls}`}>{pct}% conf</span>
}
