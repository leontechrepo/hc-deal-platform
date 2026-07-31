import { computeAllInRate, computeTotalLeverage } from '../../utils/creditFormulas'
import type { Deal } from '../../types'
import type { SimulatorValues } from './SensitivitySimulator'
import styles from './ScenarioTable.module.css'

interface Props {
  deal: Deal
  simulated: SimulatorValues
}

function fmtM(v: number | null): string {
  return v === null ? '—' : `$${v.toFixed(1)}M`
}

function fmtPct(v: number | null): string {
  return v === null ? '—' : `${v.toFixed(2)}%`
}

function fmtX(v: number | null): string {
  return v === null ? '—' : `${v.toFixed(2)}x`
}

export function ScenarioTable({ deal, simulated }: Props) {
  const simAllInRate = computeAllInRate(simulated.sofrRate, simulated.spreadBps)
  const simTotalLeverage = computeTotalLeverage(simulated.dealSizeM, simulated.ltmEbitdaM)

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Scenario</th>
          <th>Deal Size</th>
          <th>LTM EBITDA</th>
          <th>SOFR Rate</th>
          <th>Spread</th>
          <th>Total Leverage</th>
          <th>All-In Rate</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className={styles.scenarioLabel}>Current (Saved)</td>
          <td>{fmtM(deal.deal_size_m)}</td>
          <td>{fmtM(deal.ltm_ebitda_m)}</td>
          <td>{fmtPct(deal.sofr_rate)}</td>
          <td>{deal.spread_bps !== null ? `${deal.spread_bps} bps` : '—'}</td>
          <td className="mono">{fmtX(deal.total_leverage)}</td>
          <td className="mono">{fmtPct(deal.all_in_rate)}</td>
        </tr>
        <tr>
          <td className={styles.scenarioLabel}>Simulated</td>
          <td>{fmtM(simulated.dealSizeM)}</td>
          <td>{fmtM(simulated.ltmEbitdaM)}</td>
          <td>{fmtPct(simulated.sofrRate)}</td>
          <td>{`${simulated.spreadBps} bps`}</td>
          <td className="mono">{fmtX(simTotalLeverage)}</td>
          <td className="mono">{fmtPct(simAllInRate)}</td>
        </tr>
      </tbody>
    </table>
  )
}
