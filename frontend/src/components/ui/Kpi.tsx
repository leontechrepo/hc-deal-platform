import { Kpi, KpiGrid, type KpiTone } from '@leontechrepo/leon-ui'
import type { ReactNode } from 'react'

export { Kpi, KpiGrid }

export interface KpiItem {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: KpiTone
}

/** A KPI strip from data: `<KpiItems items={[{ label, value }]} />`. */
export function KpiItems({ items }: { items: KpiItem[] }) {
  return (
    <KpiGrid>
      {items.map((item) => (
        <Kpi key={item.label} {...item} />
      ))}
    </KpiGrid>
  )
}
