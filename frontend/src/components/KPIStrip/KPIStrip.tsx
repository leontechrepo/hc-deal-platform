import type { KPIs } from '../../types'
import styles from './KPIStrip.module.css'

interface Props {
  kpis: KPIs
}

export function KPIStrip({ kpis }: Props) {
  const items = [
    { label: 'Total Reviewed', value: kpis.total_reviewed },
    { label: 'Closed Deals', value: kpis.closed },
    { label: 'Capital Deployed', value: `$${kpis.deployed_m.toFixed(1)}M` },
    { label: 'Active Diligence', value: kpis.active_diligence },
    { label: 'Active Discussions', value: kpis.active_discussions },
    { label: 'Passed / Hold', value: kpis.passed },
  ]

  return (
    <div className={styles.strip}>
      {items.map(item => (
        <div key={item.label} className={styles.kpi}>
          <span className={styles.value}>{item.value}</span>
          <span className={styles.label}>{item.label}</span>
        </div>
      ))}
    </div>
  )
}
