import styles from './KPICard.module.css'

type Accent = 'gold' | 'navy' | 'green' | 'red'

interface Props {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  accent?: Accent
}

export function KPICard({ label, value, sub, accent = 'gold' }: Props) {
  return (
    <div className={[styles.kpiCard, styles[accent]].join(' ')}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {sub && <span className={styles.sub}>{sub}</span>}
    </div>
  )
}
