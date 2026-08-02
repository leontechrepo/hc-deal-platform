import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal/Modal'
import { Button } from '../ui/Button/Button'
import { PIPELINE_STAGES, formatPipelineStage } from '../shared/PipelineStageBadge'
import { STATUSES } from '../shared/StatusBadge'
import { useCreateDeal } from '../../hooks/useDeals'
import { useCurrentActor } from '../../hooks/useCurrentActor'
import { useToast } from '../../components/Toast/Toast'
import type { CreateDealInput } from '../../types'
import formStyles from '../shared/Form.module.css'

const EMPTY: CreateDealInput = {
  company_name: '',
  location: '',
  sector_primary: '',
  sector_full: '',
  subsector: '',
  security: '',
  uop: '',
  source: '',
  state: '',
  contact_name: '',
  contact_role: '',
  employees: null,
  locations_count: null,
  year_founded: null,
  deal_size_m: null,
  hold_amount_m: null,
  tenor_months: null,
  oid_pct: null,
  spread_bps: null,
  sofr_rate: null,
  sofr_floor_pct: null,
  ltm_revenue_m: null,
  ltm_ebitda_m: null,
  capex_m: null,
  ebitda_margin: null,
  revenue_growth_pct: null,
  max_leverage_covenant: null,
  min_fccr_covenant: null,
  capex_limit_covenant_m: null,
  pipeline_stage: 'sourcing',
  status: 'Active',
}

interface Props {
  open: boolean
  onClose: () => void
}

function toNullableNumber(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

export function NewDealModal({ open, onClose }: Props) {
  const [form, setForm] = useState<CreateDealInput>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const createDeal = useCreateDeal()
  const actor = useCurrentActor()
  const { showToast } = useToast()

  useEffect(() => {
    if (open) {
      setForm(EMPTY)
      setError(null)
    }
  }, [open])

  function set<K extends keyof CreateDealInput>(key: K, value: CreateDealInput[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company_name.trim()) {
      setError('Company name is required.')
      return
    }
    setError(null)
    try {
      await createDeal.mutateAsync({ ...form, actor })
      showToast(`New deal added: ${form.company_name}`)
      onClose()
    } catch {
      setError('Save failed — please try again.')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Deal">
      <form className={formStyles.form} onSubmit={handleSubmit}>
        <div className={formStyles.field}>
          <label className={formStyles.label}>Company Name *</label>
          <input
            className={formStyles.input}
            value={form.company_name}
            onChange={e => set('company_name', e.target.value)}
            autoFocus
          />
        </div>

        <div className={formStyles.sectionLabel}>Company &amp; Contact</div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Location</label>
            <input className={formStyles.input} value={form.location ?? ''} onChange={e => set('location', e.target.value)} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>State</label>
            <input className={formStyles.input} value={form.state ?? ''} onChange={e => set('state', e.target.value)} />
          </div>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Sector (Primary)</label>
            <input className={formStyles.input} value={form.sector_primary ?? ''} onChange={e => set('sector_primary', e.target.value)} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Subsector</label>
            <input className={formStyles.input} value={form.subsector ?? ''} onChange={e => set('subsector', e.target.value)} />
          </div>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Sector (Full)</label>
            <input className={formStyles.input} value={form.sector_full ?? ''} onChange={e => set('sector_full', e.target.value)} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Source</label>
            <input className={formStyles.input} value={form.source ?? ''} onChange={e => set('source', e.target.value)} />
          </div>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Contact Name</label>
            <input className={formStyles.input} value={form.contact_name ?? ''} onChange={e => set('contact_name', e.target.value)} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Contact Role</label>
            <input className={formStyles.input} value={form.contact_role ?? ''} onChange={e => set('contact_role', e.target.value)} />
          </div>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Employees</label>
            <input className={formStyles.input} type="number" step="any" value={form.employees ?? ''} onChange={e => set('employees', toNullableNumber(e.target.value))} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Locations</label>
            <input className={formStyles.input} type="number" step="any" value={form.locations_count ?? ''} onChange={e => set('locations_count', toNullableNumber(e.target.value))} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Year Founded</label>
            <input className={formStyles.input} type="number" step="any" value={form.year_founded ?? ''} onChange={e => set('year_founded', toNullableNumber(e.target.value))} />
          </div>
        </div>

        <div className={formStyles.sectionLabel}>Deal Structure</div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Pipeline Stage</label>
            <select className={formStyles.select} value={form.pipeline_stage} onChange={e => set('pipeline_stage', e.target.value)}>
              {PIPELINE_STAGES.map(s => <option key={s} value={s}>{formatPipelineStage(s)}</option>)}
            </select>
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Status</label>
            <select className={formStyles.select} value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Security</label>
            <input className={formStyles.input} value={form.security ?? ''} onChange={e => set('security', e.target.value)} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Use of Proceeds</label>
            <input className={formStyles.input} value={form.uop ?? ''} onChange={e => set('uop', e.target.value)} />
          </div>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Deal Size ($M)</label>
            <input className={formStyles.input} type="number" step="any" value={form.deal_size_m ?? ''} onChange={e => set('deal_size_m', toNullableNumber(e.target.value))} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Hold Amount ($M)</label>
            <input className={formStyles.input} type="number" step="any" value={form.hold_amount_m ?? ''} onChange={e => set('hold_amount_m', toNullableNumber(e.target.value))} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Tenor (Months)</label>
            <input className={formStyles.input} type="number" step="any" value={form.tenor_months ?? ''} onChange={e => set('tenor_months', toNullableNumber(e.target.value))} />
          </div>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>OID (%)</label>
            <input className={formStyles.input} type="number" step="any" value={form.oid_pct ?? ''} onChange={e => set('oid_pct', toNullableNumber(e.target.value))} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Spread (bps)</label>
            <input className={formStyles.input} type="number" step="any" value={form.spread_bps ?? ''} onChange={e => set('spread_bps', toNullableNumber(e.target.value))} />
          </div>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>SOFR Rate (%)</label>
            <input className={formStyles.input} type="number" step="any" value={form.sofr_rate ?? ''} onChange={e => set('sofr_rate', toNullableNumber(e.target.value))} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>SOFR Floor (%)</label>
            <input className={formStyles.input} type="number" step="any" value={form.sofr_floor_pct ?? ''} onChange={e => set('sofr_floor_pct', toNullableNumber(e.target.value))} />
          </div>
        </div>

        <div className={formStyles.sectionLabel}>Financials &amp; Covenants (Optional)</div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>LTM Revenue ($M)</label>
            <input className={formStyles.input} type="number" step="any" value={form.ltm_revenue_m ?? ''} onChange={e => set('ltm_revenue_m', toNullableNumber(e.target.value))} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>LTM EBITDA ($M)</label>
            <input className={formStyles.input} type="number" step="any" value={form.ltm_ebitda_m ?? ''} onChange={e => set('ltm_ebitda_m', toNullableNumber(e.target.value))} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>EBITDA Margin (%)</label>
            <input className={formStyles.input} type="number" step="any" value={form.ebitda_margin ?? ''} onChange={e => set('ebitda_margin', toNullableNumber(e.target.value))} />
          </div>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Capex ($M)</label>
            <input className={formStyles.input} type="number" step="any" value={form.capex_m ?? ''} onChange={e => set('capex_m', toNullableNumber(e.target.value))} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Revenue Growth (%)</label>
            <input className={formStyles.input} type="number" step="any" value={form.revenue_growth_pct ?? ''} onChange={e => set('revenue_growth_pct', toNullableNumber(e.target.value))} />
          </div>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Max Leverage Covenant</label>
            <input className={formStyles.input} type="number" step="any" value={form.max_leverage_covenant ?? ''} onChange={e => set('max_leverage_covenant', toNullableNumber(e.target.value))} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Min FCCR Covenant</label>
            <input className={formStyles.input} type="number" step="any" value={form.min_fccr_covenant ?? ''} onChange={e => set('min_fccr_covenant', toNullableNumber(e.target.value))} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Capex Limit Covenant ($M)</label>
            <input className={formStyles.input} type="number" step="any" value={form.capex_limit_covenant_m ?? ''} onChange={e => set('capex_limit_covenant_m', toNullableNumber(e.target.value))} />
          </div>
        </div>

        {error && <div className={formStyles.error}>{error}</div>}

        <div className={formStyles.actions}>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={createDeal.isPending}>
            {createDeal.isPending ? 'Saving…' : 'Create Deal'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
