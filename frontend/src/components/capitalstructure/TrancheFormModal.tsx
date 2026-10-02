import { useId, useState } from 'react'
import { Button, Field, FieldLabel } from '@leontechrepo/leon-ui'
import { Modal } from '../ui/Modal/Modal'
import { Form, FormActions, FormError, FormRow, TextField } from '../ui/Form/Form'
import { toNullableNumber } from '../../domain/format'
import type { CapitalStructureTranche, CapitalStructureTrancheInput } from '../../types'

type FormState = Omit<Partial<CapitalStructureTrancheInput>, 'amount'> & { amountDollars: string }

const EMPTY: FormState = {
  tranche_type: '', holder: '', amountDollars: '', seniority_rank: null, is_lcg_position: false,
}

interface Props {
  open: boolean
  onClose: () => void
  initial?: CapitalStructureTranche | null
  onSubmit: (body: Partial<CapitalStructureTrancheInput>) => Promise<unknown>
}

export function TrancheFormModal({ open, onClose, initial, onSubmit }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Tranche' : 'Add Tranche'}>
      <TrancheForm onClose={onClose} initial={initial} onSubmit={onSubmit} />
    </Modal>
  )
}

function TrancheForm({ onClose, initial, onSubmit }: Omit<Props, 'open'>) {
  const [form, setForm] = useState<FormState>(() =>
    initial
      ? { ...EMPTY, ...initial, amountDollars: initial.amount !== null ? String(initial.amount / 100) : '' }
      : EMPTY,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lcgId = useId()
  const isEdit = !!initial

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const { amountDollars, ...rest } = form
      const amount = amountDollars.trim() === '' ? null : Math.round(Number(amountDollars) * 100)
      await onSubmit({ ...rest, amount })
      onClose()
    } catch {
      setError('Save failed — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form onSubmit={handleSubmit}>
      <FormRow>
        <TextField
          label="Tranche Type"
          value={form.tranche_type ?? ''}
          onChange={e => set('tranche_type', e.target.value)}
          placeholder="e.g. First Lien Term Loan"
        />
        <TextField label="Holder" value={form.holder ?? ''} onChange={e => set('holder', e.target.value)} />
      </FormRow>

      <FormRow>
        <TextField
          label="Amount ($)"
          type="number"
          step="any"
          value={form.amountDollars}
          onChange={e => set('amountDollars', e.target.value)}
        />
        <TextField
          label="Seniority Rank"
          type="number"
          value={form.seniority_rank ?? ''}
          onChange={e => set('seniority_rank', toNullableNumber(e.target.value))}
        />
      </FormRow>

      <Field orientation="horizontal">
        <input
          id={lcgId}
          type="checkbox"
          checked={form.is_lcg_position ?? false}
          onChange={e => set('is_lcg_position', e.target.checked)}
        />
        <FieldLabel htmlFor={lcgId}>LCG Position</FieldLabel>
      </Field>

      {error && <FormError>{error}</FormError>}

      <FormActions>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Tranche'}
        </Button>
      </FormActions>
    </Form>
  )
}
