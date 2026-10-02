import { useState } from 'react'
import { Button } from '@leontechrepo/leon-ui'
import { Modal } from '../ui/Modal/Modal'
import { Form, FormActions, FormError, FormRow, SelectField, TextField } from '../ui/Form/Form'
import { toNullableNumber } from '../../domain/format'
import type { Fund, FundInput } from '../../types'

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

export function FundFormModal({ open, onClose, initial, onSubmit }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Fund' : 'New Fund'}>
      <FundForm onClose={onClose} initial={initial} onSubmit={onSubmit} />
    </Modal>
  )
}

function FundForm({ onClose, initial, onSubmit }: Omit<Props, 'open'>) {
  const [form, setForm] = useState<FundFormState>(() =>
    initial ? { ...EMPTY, ...initial, focus_sectors_text: (initial.focus_sectors ?? []).join(', ') } : EMPTY,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEdit = !!initial

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

  const num = (key: keyof FundFormState) => ({
    type: 'number' as const,
    step: 'any',
    value: (form[key] as number | null | undefined) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      set(key, toNullableNumber(e.target.value) as never),
  })
  const txt = (key: keyof FundFormState) => ({
    value: (form[key] as string | null | undefined) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, e.target.value as never),
  })

  return (
    <Form onSubmit={handleSubmit}>
      <FormRow>
        <TextField label="Name *" {...txt('name')} />
        <TextField label="Vintage" {...txt('vintage')} />
      </FormRow>

      <FormRow>
        <SelectField
          label="Status"
          value={form.status ?? ''}
          onChange={e => set('status', (e.target.value || null) as FundFormState['status'])}
        >
          <option value="">—</option>
          <option value="Investing">Investing</option>
          <option value="Fundraising">Fundraising</option>
        </SelectField>
        <TextField label="Strategy" {...txt('strategy')} />
      </FormRow>

      <FormRow>
        <TextField label="Total Commitment ($M)" {...num('total_commitment_m')} />
        <TextField label="Called Capital ($M)" {...num('called_capital_m')} />
      </FormRow>

      <FormRow>
        <TextField label="Deployed Capital ($M)" {...num('deployed_capital_m')} />
        <TextField label="Available Capital ($M)" {...num('available_capital_m')} />
      </FormRow>

      <TextField
        label="Focus Sectors (comma-separated)"
        {...txt('focus_sectors_text')}
        placeholder="Healthcare, Industrials"
      />

      <FormRow>
        <TextField label="Target Return" {...txt('target_return')} />
        <TextField label="Target Leverage (x)" {...num('target_leverage')} />
      </FormRow>

      <FormRow>
        <TextField label="Max Single Exposure (%)" {...num('max_single_exposure_pct')} />
        <TextField label="Target Hold" {...txt('target_hold')} />
      </FormRow>

      <FormRow>
        <TextField label="GP Commitment ($M)" {...num('gp_commitment_m')} />
        <TextField label="Mgmt Fee (%)" {...num('mgmt_fee_pct')} />
      </FormRow>

      <FormRow>
        <TextField label="Carried Interest (%)" {...num('carried_interest_pct')} />
        <TextField label="Investment Period" {...txt('investment_period')} />
      </FormRow>

      <TextField label="Fund Life" {...txt('fund_life')} />

      {error && <FormError>{error}</FormError>}

      <FormActions>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Fund'}
        </Button>
      </FormActions>
    </Form>
  )
}
