import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal/Modal'
import { Button } from '../ui/Button/Button'
import { COVENANT_TEST_FREQUENCIES, COVENANT_TYPES } from '../../types'
import type { Covenant, CovenantInput, CovenantPatchInput } from '../../types'
import formStyles from '../shared/Form.module.css'

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

function toNullableNumber(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

export function CovenantFormModal({ open, onClose, initial, onSubmit }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEdit = !!initial
  const isFinancial = form.covenant_type === 'Financial'

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...EMPTY, ...initial } : EMPTY)
      setError(null)
    }
  }, [open, initial])

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
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Covenant' : 'Add Covenant'}>
      <form className={formStyles.form} onSubmit={handleSubmit}>
        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Covenant Type *</label>
            <select
              className={formStyles.select}
              value={form.covenant_type ?? ''}
              onChange={e => setCovenantType(e.target.value as FormState['covenant_type'])}
            >
              {COVENANT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Test Frequency</label>
            <select
              className={formStyles.select}
              value={form.test_frequency ?? ''}
              onChange={e => set('test_frequency', (e.target.value || null) as FormState['test_frequency'])}
            >
              <option value="">—</option>
              {COVENANT_TEST_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>Covenant Name *</label>
          <input
            className={formStyles.input}
            value={form.covenant_name ?? ''}
            onChange={e => set('covenant_name', e.target.value)}
            placeholder="e.g. Max Total Leverage"
          />
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>
            Threshold Value {!isFinancial && <span className={formStyles.lockedNote}>(Financial covenants only)</span>}
          </label>
          <input
            className={formStyles.input}
            type="number"
            step="any"
            disabled={!isFinancial}
            value={form.threshold_value ?? ''}
            onChange={e => set('threshold_value', toNullableNumber(e.target.value))}
          />
        </div>

        {error && <div className={formStyles.error}>{error}</div>}

        <div className={formStyles.actions}>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Covenant'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
