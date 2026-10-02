import { useState } from 'react'
import { Button } from '@leontechrepo/leon-ui'
import { Modal } from '../ui/Modal/Modal'
import { Form, FormActions, FormError, FormRow, SelectField, TextField } from '../ui/Form/Form'
import { toNullableNumber } from '../../domain/format'
import { COVENANT_TEST_FREQUENCIES, COVENANT_TYPES } from '../../types'
import type { Covenant, CovenantInput, CovenantPatchInput } from '../../types'

type FormState = Partial<CovenantInput>

const EMPTY: FormState = {
  covenant_type: 'Financial',
  covenant_name: '',
  threshold_value: null,
  test_frequency: null,
}

interface Props {
  open: boolean
  onClose: () => void
  initial?: Covenant | null
  onSubmit: (body: Partial<CovenantInput> | CovenantPatchInput) => Promise<unknown>
}

export function CovenantFormModal({ open, onClose, initial, onSubmit }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Covenant' : 'Add Covenant'}>
      <CovenantForm onClose={onClose} initial={initial} onSubmit={onSubmit} />
    </Modal>
  )
}

function CovenantForm({ onClose, initial, onSubmit }: Omit<Props, 'open'>) {
  const [form, setForm] = useState<FormState>(() => (initial ? { ...EMPTY, ...initial } : EMPTY))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEdit = !!initial
  const isFinancial = form.covenant_type === 'Financial'

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function setCovenantType(value: FormState['covenant_type']) {
    setForm(f => ({ ...f, covenant_type: value, threshold_value: value === 'Financial' ? f.threshold_value : null }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.covenant_type) {
      setError('Covenant type is required.')
      return
    }
    if (!form.covenant_name?.trim()) {
      setError('Covenant name is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSubmit(form)
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
        <SelectField
          label="Covenant Type *"
          value={form.covenant_type ?? ''}
          onChange={e => setCovenantType(e.target.value as FormState['covenant_type'])}
        >
          {COVENANT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </SelectField>
        <SelectField
          label="Test Frequency"
          value={form.test_frequency ?? ''}
          onChange={e => set('test_frequency', (e.target.value || null) as FormState['test_frequency'])}
        >
          <option value="">—</option>
          {COVENANT_TEST_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
        </SelectField>
      </FormRow>

      <TextField
        label="Covenant Name *"
        value={form.covenant_name ?? ''}
        onChange={e => set('covenant_name', e.target.value)}
        placeholder="e.g. Max Total Leverage"
      />

      <TextField
        label={<>Threshold Value {!isFinancial && '(Financial covenants only)'}</>}
        type="number"
        step="any"
        disabled={!isFinancial}
        value={form.threshold_value ?? ''}
        onChange={e => set('threshold_value', toNullableNumber(e.target.value))}
      />

      {error && <FormError>{error}</FormError>}

      <FormActions>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Covenant'}
        </Button>
      </FormActions>
    </Form>
  )
}
