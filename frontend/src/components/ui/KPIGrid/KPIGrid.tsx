import { KPICard } from '../KPICard/KPICard'
import styles from './KPIGrid.module.css'

export interface KPITileData {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  accent?: 'gold' | 'navy' | 'green' | 'red'
}

interface Props {
  items: KPITileData[]
  flat?: boolean
}

export function KPIGrid({ items, flat = false }: Props) {
  return (
    <div className={styles.grid}>
      {items.map(item => (
        <KPICard key={item.label} {...item} flat={flat} />
      ))}
    </div>
  )
}
