import { useDealContext } from '../dealContext'
import { useState } from 'react'
import { usePatchDeal } from '../../../hooks/useDeals'
import { useCurrentActor } from '../../../hooks/useCurrentActor'
import { useToast } from '../../../components/Toast/Toast'
import { InlineEditText } from '../../../components/ui/InlineEditText/InlineEditText'
import { Card, CardTitle, Input } from '@leontechrepo/leon-ui'
import { FieldRow, FieldHint, ReadOnlyValue } from '../../../components/dealDetail/FieldRow'
import { formatPipelineStage, isAtOrPastLockStage } from '../../../domain/stages'
import { SensitivitySimulator, type SimulatorValues } from '../../../components/dealDetail/SensitivitySimulator'
import { ScenarioTable } from '../../../components/dealDetail/ScenarioTable'
import { ExcelExportButton } from '../../../components/dealDetail/ExcelExportButton'
import { computeAllInRate, computeTotalLeverage } from '../../../utils/creditFormulas'
import styles from './UnderwritingTab.module.css'

function LockAwareText({ locked, value, onSave, multiline }: {
  locked: boolean
  value: string | null
  onSave: (value: string | null) => Promise<unknown>
  multiline?: boolean
}) {
  if (locked) return <ReadOnlyValue>{value ?? '—'}</ReadOnlyValue>
  return <InlineEditText value={value} onSave={onSave} multiline={multiline} />
}

function LockAwareDate({ locked, dealId, field, value, actor }: {
  locked: boolean
  dealId: string
  field: string
  value: string | null
  actor?: string
}) {
  const patchMutation = usePatchDeal()
  const { showToast } = useToast()

  if (locked) return <ReadOnlyValue>{value ?? '—'}</ReadOnlyValue>

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      await patchMutation.mutateAsync({ dealId, field, value: e.target.value || null, actor })
      showToast('Saved')
    } catch {
      showToast('Save failed', true)
    }
  }

  return <Input type="date" value={value ?? ''} onChange={onChange} aria-label={field} />
}

export function UnderwritingTab() {
  const { deal } = useDealContext()
  const patchMutation = usePatchDeal()
  const actor = useCurrentActor()
  // Read-only once the deal reaches loi_signed or later. The backend flag is
  // authoritative; the stage check keeps the UI honest if it is stale.
  const locked = deal.underwriting_locked || isAtOrPastLockStage(deal.pipeline_stage)

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
    <div className="detail-cards">
      {locked && (
        <div className={styles.lockedBanner} role="status">
          Underwriting fields are locked — this deal has reached {formatPipelineStage(deal.pipeline_stage)} or later.
          Contact an admin to unlock.
        </div>
      )}

      <Card>
        <CardTitle>Deal Terms</CardTitle>
        <FieldRow label="Deal Size ($M)">
          <LockAwareText locked={locked} value={deal.deal_size_m?.toString() ?? null} onSave={saveField('deal_size_m')} />
        </FieldRow>
        <FieldRow label="Hold Amount ($M)">
          <LockAwareText locked={locked} value={deal.hold_amount_m?.toString() ?? null} onSave={saveField('hold_amount_m')} />
        </FieldRow>
        <FieldRow label="Security">
          <LockAwareText locked={locked} value={deal.security} onSave={saveField('security')} />
        </FieldRow>
        <FieldRow label="Tenor (Months)">
          <LockAwareText locked={locked} value={deal.tenor_months?.toString() ?? null} onSave={saveField('tenor_months')} />
        </FieldRow>
        <FieldRow label="Amortization">
          <LockAwareText locked={locked} value={deal.amortization} onSave={saveField('amortization')} />
        </FieldRow>
        <FieldRow label="OID (%)">
          <LockAwareText locked={locked} value={deal.oid_pct?.toString() ?? null} onSave={saveField('oid_pct')} />
        </FieldRow>
        <FieldRow label="Call Protection">
          <LockAwareText locked={locked} value={deal.call_protection} onSave={saveField('call_protection')} />
        </FieldRow>
        <FieldRow label="Maturity Date">
          <LockAwareDate locked={locked} dealId={deal.id} field="maturity_date" value={deal.maturity_date} actor={actor} />
        </FieldRow>
        <FieldRow label="Base Rate">
          <LockAwareText locked={locked} value={deal.base_rate} onSave={saveField('base_rate')} />
        </FieldRow>
        <FieldRow label="SOFR Rate (%)">
          <LockAwareText locked={locked} value={deal.sofr_rate?.toString() ?? null} onSave={saveField('sofr_rate')} />
        </FieldRow>
        <FieldRow label="SOFR Floor (%)">
          <LockAwareText locked={locked} value={deal.sofr_floor_pct?.toString() ?? null} onSave={saveField('sofr_floor_pct')} />
        </FieldRow>
        <FieldRow label="Spread (bps)">
          <LockAwareText locked={locked} value={deal.spread_bps?.toString() ?? null} onSave={saveField('spread_bps')} />
        </FieldRow>
        <FieldRow label="All-In Rate (%)">
          <LockAwareText locked={locked} value={deal.all_in_rate?.toString() ?? null} onSave={saveField('all_in_rate')} />
          {liveAllInRate !== null && (
            <FieldHint>formula: SOFR + Spread ÷ 100 = {liveAllInRate.toFixed(2)}%</FieldHint>
          )}
        </FieldRow>
        <FieldRow label="Total Leverage (x)">
          <LockAwareText locked={locked} value={deal.total_leverage?.toString() ?? null} onSave={saveField('total_leverage')} />
          {liveTotalLeverage !== null && (
            <FieldHint>formula: Deal Size ÷ LTM EBITDA = {liveTotalLeverage.toFixed(2)}x</FieldHint>
          )}
        </FieldRow>
      </Card>

      <Card>
        <CardTitle>Financials</CardTitle>
        <FieldRow label="LTM Revenue ($M)">
          <LockAwareText locked={locked} value={deal.ltm_revenue_m?.toString() ?? null} onSave={saveField('ltm_revenue_m')} />
        </FieldRow>
        <FieldRow label="LTM EBITDA ($M)">
          <LockAwareText locked={locked} value={deal.ltm_ebitda_m?.toString() ?? null} onSave={saveField('ltm_ebitda_m')} />
        </FieldRow>
        <FieldRow label="EBITDA Margin (%)">
          <LockAwareText locked={locked} value={deal.ebitda_margin?.toString() ?? null} onSave={saveField('ebitda_margin')} />
        </FieldRow>
        <FieldRow label="Revenue Growth (%)">
          <LockAwareText locked={locked} value={deal.revenue_growth_pct?.toString() ?? null} onSave={saveField('revenue_growth_pct')} />
        </FieldRow>
        <FieldRow label="EBITDA Growth (%)">
          <LockAwareText locked={locked} value={deal.ebitda_growth_pct?.toString() ?? null} onSave={saveField('ebitda_growth_pct')} />
        </FieldRow>
        <FieldRow label="Capex ($M)">
          <LockAwareText locked={locked} value={deal.capex_m?.toString() ?? null} onSave={saveField('capex_m')} />
        </FieldRow>
        <FieldRow label="FCF ($M)">
          <LockAwareText locked={locked} value={deal.fcf_m?.toString() ?? null} onSave={saveField('fcf_m')} />
        </FieldRow>
        <FieldRow label="DSCR">
          <LockAwareText locked={locked} value={deal.dscr?.toString() ?? null} onSave={saveField('dscr')} />
        </FieldRow>
        <FieldRow label="FCCR">
          <LockAwareText locked={locked} value={deal.fccr?.toString() ?? null} onSave={saveField('fccr')} />
        </FieldRow>
        <FieldRow label="Interest Coverage">
          <LockAwareText locked={locked} value={deal.interest_coverage?.toString() ?? null} onSave={saveField('interest_coverage')} />
        </FieldRow>
      </Card>

      <Card>
        <CardTitle>Covenants</CardTitle>
        <FieldRow label="Max Leverage Covenant">
          <LockAwareText locked={locked} value={deal.max_leverage_covenant?.toString() ?? null} onSave={saveField('max_leverage_covenant')} />
        </FieldRow>
        <FieldRow label="Min FCCR Covenant">
          <LockAwareText locked={locked} value={deal.min_fccr_covenant?.toString() ?? null} onSave={saveField('min_fccr_covenant')} />
        </FieldRow>
        <FieldRow label="Capex Limit Covenant ($M)">
          <LockAwareText locked={locked} value={deal.capex_limit_covenant_m?.toString() ?? null} onSave={saveField('capex_limit_covenant_m')} />
        </FieldRow>
      </Card>

      <Card>
        <div className={styles.simHeader}>
          <CardTitle>Sensitivity Simulator</CardTitle>
          <ExcelExportButton dealId={deal.id} companyName={deal.company_name} />
        </div>
        <SensitivitySimulator values={sim} onChange={setSim} />
        <div className={styles.scenarioWrap}>
          <ScenarioTable deal={deal} simulated={sim} />
        </div>
      </Card>
    </div>
  )
}
