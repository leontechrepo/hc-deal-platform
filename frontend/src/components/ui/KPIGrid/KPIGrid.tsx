import styles from './KPIGrid.module.css'

export interface KPITileData {
  label: string
  value: React.ReactNode
}

export function KPITile({ label, value }: KPITileData) {
  return (
    <div className={styles.kpi}>
      <span className={styles.value}>{value}</span>
      <span className={styles.label}>{label}</span>
    </div>
  )
}

export function KPIGrid({ items }: { items: KPITileData[] }) {
  return (
    <div className={styles.strip}>
      {items.map(item => (
        <KPITile key={item.label} label={item.label} value={item.value} />
      ))}
    </div>
  )
}
