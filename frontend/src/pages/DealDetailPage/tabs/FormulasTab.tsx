import { useOutletContext } from 'react-router-dom'
import { computeAllInRate, computeTotalLeverage } from '../../../utils/creditFormulas'
import type { Deal } from '../../../types'
import styles from './FormulasTab.module.css'

function fmtPct(v: number | null): string {
  return v === null ? '—' : `${v.toFixed(2)}%`
}

function fmtX(v: number | null): string {
  return v === null ? '—' : `${v.toFixed(2)}x`
}

function fmtM(v: number | null): string {
  return v === null ? '—' : `$${v.toFixed(1)}M`
}

export function FormulasTab() {
  const { deal } = useOutletContext<{ deal: Deal }>()

  const computedAllInRate = computeAllInRate(deal.sofr_rate, deal.spread_bps)
  const computedTotalLeverage = computeTotalLeverage(deal.deal_size_m, deal.ltm_ebitda_m)

  const allInRateDrift = deal.all_in_rate !== null && computedAllInRate !== null && Math.abs(deal.all_in_rate - computedAllInRate) > 0.01
  const totalLeverageDrift = deal.total_leverage !== null && computedTotalLeverage !== null && Math.abs(deal.total_leverage - computedTotalLeverage) > 0.01

  return (
    <div className={styles.tab}>
      <div className={styles.card}>
        <h2 className={styles.title}>All-In Rate</h2>
        <p className={styles.formula}>SOFR Rate + Spread (bps) ÷ 100</p>
        <div className={styles.inputs}>
          <span>SOFR Rate: {fmtPct(deal.sofr_rate)}</span>
          <span>Spread: {deal.spread_bps !== null ? `${deal.spread_bps} bps` : '—'}</span>
        </div>
        <div className={styles.results}>
          <div className={styles.result}>
            <span className={styles.resultLabel}>Computed</span>
            <span className={styles.resultValue}>{fmtPct(computedAllInRate)}</span>
          </div>
          <div className={styles.result}>
            <span className={styles.resultLabel}>Stored on Deal</span>
            <span className={styles.resultValue}>{fmtPct(deal.all_in_rate)}</span>
          </div>
        </div>
        {allInRateDrift && (
          <p className={styles.drift}>Stored value differs from the formula — may have been manually overridden or imported from Excel.</p>
        )}
      </div>

      <div className={styles.card}>
        <h2 className={styles.title}>Total Leverage</h2>
        <p className={styles.formula}>Deal Size ($M) ÷ LTM EBITDA ($M)</p>
        <div className={styles.inputs}>
          <span>Deal Size: {fmtM(deal.deal_size_m)}</span>
          <span>LTM EBITDA: {fmtM(deal.ltm_ebitda_m)}</span>
        </div>
        <div className={styles.results}>
          <div className={styles.result}>
            <span className={styles.resultLabel}>Computed</span>
            <span className={styles.resultValue}>{fmtX(computedTotalLeverage)}</span>
          </div>
          <div className={styles.result}>
            <span className={styles.resultLabel}>Stored on Deal</span>
            <span className={styles.resultValue}>{fmtX(deal.total_leverage)}</span>
          </div>
        </div>
        {totalLeverageDrift && (
          <p className={styles.drift}>Stored value differs from the formula — may have been manually overridden or imported from Excel.</p>
        )}
      </div>

      <p className={styles.note}>
        DSCR, FCCR, and Interest Coverage are entered directly on the Underwriting tab — this platform
        does not enforce a standard formula for them.
      </p>
    </div>
  )
}
