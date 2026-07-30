import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal/Modal'
import { Button } from '../ui/Button/Button'
import type { Fund, FundInput } from '../../types'
import formStyles from '../shared/Form.module.css'

type FundFormState = Partial<FundInput> & { focus_sectors_text?: string }

const EMPTY: FundFormState = {
  name: '',
  vintage: '',
  status: null,
  total_commitment_m: null,
  called_capital_m: null,
  deployed_capital_m: null,
  available_capital_m: null,
  target_return: '',
  strategy: '',
  focus_sectors_text: '',
  max_single_exposure_pct: null,
  target_leverage: null,
  target_hold: '',
  gp_commitment_m: null,
  mgmt_fee_pct: null,
  carried_interest_pct: null,
  investment_period: '',
  fund_life: '',
}

interface Props {
  open: boolean
  onClose: () => void
  initial?: Fund | null
  onSubmit: (body: Partial<FundInput>) => Promise<unknown>
}

function toNullableNumber(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

export function FundFormModal({ open, onClose, initial, onSubmit }: Props) {
  const [form, setForm] = useState<FundFormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEdit = !!initial

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...EMPTY, ...initial, focus_sectors_text: (initial.focus_sectors ?? []).join(', ') } : EMPTY)
      setError(null)
    }
  }, [open, initial])

  function set<K extends keyof FundFormState>(key: K, value: FundFormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name?.trim()) {
      setError('Fund name is required.')
      return
    }
    setSaving(true)
    setError(null)
    const { focus_sectors_text, ...rest } = form
    const body: Partial<FundInput> = {
      ...rest,
      focus_sectors: focus_sectors_text
        ? focus_sectors_text.split(',').map(s => s.trim()).filter(Boolean)
        : [],
    }
    try {
      await onSubmit(body)
      onClose()
    } catch {
      setError('Save failed — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Fund' : 'New Fund'}>
      <form className={formStyles.form} onSubmit={handleSubmit}>
        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Name *</label>
            <input className={formStyles.input} value={form.name ?? ''} onChange={e => set('name', e.target.value)} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Vintage</label>
            <input className={formStyles.input} value={form.vintage ?? ''} onChange={e => set('vintage', e.target.value)} />
          </div>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Status</label>
            <select
              className={formStyles.select}
              value={form.status ?? ''}
              onChange={e => set('status', (e.target.value || null) as FundFormState['status'])}
            >
              <option value="">—</option>
              <option value="Investing">Investing</option>
              <option value="Fundraising">Fundraising</option>
            </select>
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Strategy</label>
            <input className={formStyles.input} value={form.strategy ?? ''} onChange={e => set('strategy', e.target.value)} />
          </div>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Total Commitment ($M)</label>
            <input className={formStyles.input} type="number"
              step="any" value={form.total_commitment_m ?? ''} onChange={e => set('total_commitment_m', toNullableNumber(e.target.value))} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Called Capital ($M)</label>
            <input className={formStyles.input} type="number"
              step="any" value={form.called_capital_m ?? ''} onChange={e => set('called_capital_m', toNullableNumber(e.target.value))} />
          </div>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Deployed Capital ($M)</label>
            <input className={formStyles.input} type="number"
              step="any" value={form.deployed_capital_m ?? ''} onChange={e => set('deployed_capital_m', toNullableNumber(e.target.value))} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Available Capital ($M)</label>
            <input className={formStyles.input} type="number"
              step="any" value={form.available_capital_m ?? ''} onChange={e => set('available_capital_m', toNullableNumber(e.target.value))} />
          </div>
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>Focus Sectors (comma-separated)</label>
          <input className={formStyles.input} value={form.focus_sectors_text ?? ''} onChange={e => set('focus_sectors_text', e.target.value)} placeholder="Healthcare, Industrials" />
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Target Return</label>
            <input className={formStyles.input} value={form.target_return ?? ''} onChange={e => set('target_return', e.target.value)} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Target Leverage (x)</label>
            <input className={formStyles.input} type="number"
              step="any" value={form.target_leverage ?? ''} onChange={e => set('target_leverage', toNullableNumber(e.target.value))} />
          </div>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Max Single Exposure (%)</label>
            <input className={formStyles.input} type="number"
              step="any" value={form.max_single_exposure_pct ?? ''} onChange={e => set('max_single_exposure_pct', toNullableNumber(e.target.value))} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Target Hold</label>
            <input className={formStyles.input} value={form.target_hold ?? ''} onChange={e => set('target_hold', e.target.value)} />
          </div>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>GP Commitment ($M)</label>
            <input className={formStyles.input} type="number"
              step="any" value={form.gp_commitment_m ?? ''} onChange={e => set('gp_commitment_m', toNullableNumber(e.target.value))} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Mgmt Fee (%)</label>
            <input className={formStyles.input} type="number"
              step="any" value={form.mgmt_fee_pct ?? ''} onChange={e => set('mgmt_fee_pct', toNullableNumber(e.target.value))} />
          </div>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Carried Interest (%)</label>
            <input className={formStyles.input} type="number"
              step="any" value={form.carried_interest_pct ?? ''} onChange={e => set('carried_interest_pct', toNullableNumber(e.target.value))} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Investment Period</label>
            <input className={formStyles.input} value={form.investment_period ?? ''} onChange={e => set('investment_period', e.target.value)} />
          </div>
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>Fund Life</label>
          <input className={formStyles.input} value={form.fund_life ?? ''} onChange={e => set('fund_life', e.target.value)} />
        </div>

        {error && <div className={formStyles.error}>{error}</div>}

        <div className={formStyles.actions}>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Fund'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
