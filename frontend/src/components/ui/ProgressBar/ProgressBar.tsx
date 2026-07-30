import styles from './ProgressBar.module.css'

type Tone = 'gold' | 'green' | 'blue'

interface Props {
  value: number
  max?: number
  tone?: Tone
}

export function ProgressBar({ value, max = 100, tone = 'gold' }: Props) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className={styles.track}>
      <div className={`${styles.fill} ${styles[tone]}`} style={{ width: `${pct}%` }} />
    </div>
  )
}
