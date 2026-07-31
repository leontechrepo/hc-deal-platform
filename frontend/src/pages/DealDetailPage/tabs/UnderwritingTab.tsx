import { useOutletContext } from 'react-router-dom'
import { useState } from 'react'
import { usePatchDeal } from '../../../hooks/useDeals'
import { useCurrentActor } from '../../../hooks/useCurrentActor'
import { useToast } from '../../../components/Toast/Toast'
import { InlineEditText } from '../../../components/ui/InlineEditText/InlineEditText'
import { formatPipelineStage } from '../../../components/shared/PipelineStageBadge'
import { SensitivitySimulator, type SimulatorValues } from '../../../components/dealDetail/SensitivitySimulator'
import { ScenarioTable } from '../../../components/dealDetail/ScenarioTable'
import { ExcelExportButton } from '../../../components/dealDetail/ExcelExportButton'
import { computeAllInRate, computeTotalLeverage } from '../../../utils/creditFormulas'
import formStyles from '../../../components/shared/Form.module.css'
import type { Deal } from '../../../types'
import styles from './UnderwritingTab.module.css'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.fieldValue}>{children}</div>
    </div>
  )
}

function LockAwareText({ locked, value, onSave, multiline }: {
  locked: boolean
  value: string | null
  onSave: (value: string | null) => Promise<unknown>
  multiline?: boolean
}) {
  if (locked) return <span className={styles.readOnly}>{value ?? '—'}</span>
  return <InlineEditText value={value} onSave={onSave} multiline={multiline} />
}

function LockAwareDate({ locked, dealId, field, value, actor }: {
  locked: boolean
  dealId: number
  field: string
  value: string | null
  actor?: string
}) {
  const patchMutation = usePatchDeal()
  const { showToast } = useToast()

  if (locked) return <span className={styles.readOnly}>{value ?? '—'}</span>

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      await patchMutation.mutateAsync({ dealId, field, value: e.target.value || null, actor })
      showToast('Saved')
    } catch {
      showToast('Save failed', true)
    }
  }

  return <input type="date" className={formStyles.input} value={value ?? ''} onChange={onChange} />
}

export function UnderwritingTab() {
  const { deal } = useOutletContext<{ deal: Deal }>()
  const patchMutation = usePatchDeal()
  const actor = useCurrentActor()
  const locked = deal.underwriting_locked

  const [sim, setSim] = useState<SimulatorValues>({
    sofrRate: deal.sofr_rate ?? 5,
    spreadBps: deal.spread_bps ?? 500,
    dealSizeM: deal.deal_size_m ?? 20,
    ltmEbitdaM: deal.ltm_ebitda_m ?? 5,
  })

  function saveField(field: string) {
    return (value: string | null) => patchMutation.mutateAsync({ dealId: deal.id, field, value, actor })
  }

  const liveAllInRate = computeAllInRate(deal.sofr_rate, deal.spread_bps)
  const liveTotalLeverage = computeTotalLeverage(deal.deal_size_m, deal.ltm_ebitda_m)

  return (
    <div className={styles.tab}>
      {locked && (
        <div className={styles.lockedBanner}>
          Underwriting fields are locked — this deal has reached {formatPipelineStage(deal.pipeline_stage)} or later.
          Contact an admin to unlock.
        </div>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Deal Terms</h2>
        <Field label="Deal Size ($M)">
          <LockAwareText locked={locked} value={deal.deal_size_m?.toString() ?? null} onSave={saveField('deal_size_m')} />
        </Field>
        <Field label="Hold Amount ($M)">
          <LockAwareText locked={locked} value={deal.hold_amount_m?.toString() ?? null} onSave={saveField('hold_amount_m')} />
        </Field>
        <Field label="Security">
          <LockAwareText locked={locked} value={deal.security} onSave={saveField('security')} />
        </Field>
        <Field label="Tenor (Months)">
          <LockAwareText locked={locked} value={deal.tenor_months?.toString() ?? null} onSave={saveField('tenor_months')} />
        </Field>
        <Field label="Amortization">
          <LockAwareText locked={locked} value={deal.amortization} onSave={saveField('amortization')} />
        </Field>
        <Field label="OID (%)">
          <LockAwareText locked={locked} value={deal.oid_pct?.toString() ?? null} onSave={saveField('oid_pct')} />
        </Field>
        <Field label="Call Protection">
          <LockAwareText locked={locked} value={deal.call_protection} onSave={saveField('call_protection')} />
        </Field>
        <Field label="Maturity Date">
          <LockAwareDate locked={locked} dealId={deal.id} field="maturity_date" value={deal.maturity_date} actor={actor} />
        </Field>
        <Field label="Base Rate">
          <LockAwareText locked={locked} value={deal.base_rate} onSave={saveField('base_rate')} />
        </Field>
        <Field label="SOFR Rate (%)">
          <LockAwareText locked={locked} value={deal.sofr_rate?.toString() ?? null} onSave={saveField('sofr_rate')} />
        </Field>
        <Field label="SOFR Floor (%)">
          <LockAwareText locked={locked} value={deal.sofr_floor_pct?.toString() ?? null} onSave={saveField('sofr_floor_pct')} />
        </Field>
        <Field label="Spread (bps)">
          <LockAwareText locked={locked} value={deal.spread_bps?.toString() ?? null} onSave={saveField('spread_bps')} />
        </Field>
        <Field label="All-In Rate (%)">
          <LockAwareText locked={locked} value={deal.all_in_rate?.toString() ?? null} onSave={saveField('all_in_rate')} />
          {liveAllInRate !== null && (
            <span className={styles.formulaHint}>formula: SOFR + Spread ÷ 100 = {liveAllInRate.toFixed(2)}%</span>
          )}
        </Field>
        <Field label="Total Leverage (x)">
          <LockAwareText locked={locked} value={deal.total_leverage?.toString() ?? null} onSave={saveField('total_leverage')} />
          {liveTotalLeverage !== null && (
            <span className={styles.formulaHint}>formula: Deal Size ÷ LTM EBITDA = {liveTotalLeverage.toFixed(2)}x</span>
          )}
        </Field>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Financials</h2>
        <Field label="LTM Revenue ($M)">
          <LockAwareText locked={locked} value={deal.ltm_revenue_m?.toString() ?? null} onSave={saveField('ltm_revenue_m')} />
        </Field>
        <Field label="LTM EBITDA ($M)">
          <LockAwareText locked={locked} value={deal.ltm_ebitda_m?.toString() ?? null} onSave={saveField('ltm_ebitda_m')} />
        </Field>
        <Field label="EBITDA Margin (%)">
          <LockAwareText locked={locked} value={deal.ebitda_margin?.toString() ?? null} onSave={saveField('ebitda_margin')} />
        </Field>
        <Field label="Revenue Growth (%)">
          <LockAwareText locked={locked} value={deal.revenue_growth_pct?.toString() ?? null} onSave={saveField('revenue_growth_pct')} />
        </Field>
        <Field label="EBITDA Growth (%)">
          <LockAwareText locked={locked} value={deal.ebitda_growth_pct?.toString() ?? null} onSave={saveField('ebitda_growth_pct')} />
        </Field>
        <Field label="Capex ($M)">
          <LockAwareText locked={locked} value={deal.capex_m?.toString() ?? null} onSave={saveField('capex_m')} />
        </Field>
        <Field label="FCF ($M)">
          <LockAwareText locked={locked} value={deal.fcf_m?.toString() ?? null} onSave={saveField('fcf_m')} />
        </Field>
        <Field label="DSCR">
          <LockAwareText locked={locked} value={deal.dscr?.toString() ?? null} onSave={saveField('dscr')} />
        </Field>
        <Field label="FCCR">
          <LockAwareText locked={locked} value={deal.fccr?.toString() ?? null} onSave={saveField('fccr')} />
        </Field>
        <Field label="Interest Coverage">
          <LockAwareText locked={locked} value={deal.interest_coverage?.toString() ?? null} onSave={saveField('interest_coverage')} />
        </Field>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Covenants</h2>
        <Field label="Max Leverage Covenant">
          <LockAwareText locked={locked} value={deal.max_leverage_covenant?.toString() ?? null} onSave={saveField('max_leverage_covenant')} />
        </Field>
        <Field label="Min FCCR Covenant">
          <LockAwareText locked={locked} value={deal.min_fccr_covenant?.toString() ?? null} onSave={saveField('min_fccr_covenant')} />
        </Field>
        <Field label="Capex Limit Covenant ($M)">
          <LockAwareText locked={locked} value={deal.capex_limit_covenant_m?.toString() ?? null} onSave={saveField('capex_limit_covenant_m')} />
        </Field>
      </section>

      <section className={styles.section}>
        <div className={styles.simHeader}>
          <h2 className={styles.sectionTitle}>Sensitivity Simulator</h2>
          <ExcelExportButton dealId={deal.id} companyName={deal.company_name} />
        </div>
        <SensitivitySimulator values={sim} onChange={setSim} />
        <div className={styles.scenarioWrap}>
          <ScenarioTable deal={deal} simulated={sim} />
        </div>
      </section>
    </div>
  )
}
