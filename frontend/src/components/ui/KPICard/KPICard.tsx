import styles from './KPICard.module.css'

type Accent = 'gold' | 'navy' | 'green' | 'red'

interface Props {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  accent?: Accent
  flat?: boolean
}

export function KPICard({ label, value, sub, accent = 'gold', flat = false }: Props) {
  const className = [styles.kpiCard, styles[accent], flat && styles.flat].filter(Boolean).join(' ')
  return (
    <div className={className}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {sub && <span className={styles.sub}>{sub}</span>}
    </div>
  )
}
