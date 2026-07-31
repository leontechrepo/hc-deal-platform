import styles from './MilestoneMarker.module.css'

interface Props {
  x: number
  label: string
}

export function MilestoneMarker({ x, label }: Props) {
  return (
    <div className={styles.wrap} style={{ left: x }}>
      <div className={styles.diamond} />
      <span className={styles.label}>{label}</span>
    </div>
  )
}
