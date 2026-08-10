import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal/Modal'
import { Button } from '../ui/Button/Button'
import type { CapitalStructureTranche, CapitalStructureTrancheInput } from '../../types'
import formStyles from '../shared/Form.module.css'

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

function toNullableNumber(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

export function TrancheFormModal({ open, onClose, initial, onSubmit }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEdit = !!initial

  useEffect(() => {
    if (open) {
      setForm(initial
        ? { ...EMPTY, ...initial, amountDollars: initial.amount !== null ? String(initial.amount / 100) : '' }
        : EMPTY)
      setError(null)
    }
  }, [open, initial])

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
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Tranche' : 'Add Tranche'}>
      <form className={formStyles.form} onSubmit={handleSubmit}>
        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Tranche Type</label>
            <input
              className={formStyles.input}
              value={form.tranche_type ?? ''}
              onChange={e => set('tranche_type', e.target.value)}
              placeholder="e.g. First Lien Term Loan"
            />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Holder</label>
            <input className={formStyles.input} value={form.holder ?? ''} onChange={e => set('holder', e.target.value)} />
          </div>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Amount ($)</label>
            <input
              className={formStyles.input}
              type="number"
              step="any"
              value={form.amountDollars}
              onChange={e => set('amountDollars', e.target.value)}
            />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Seniority Rank</label>
            <input
              className={formStyles.input}
              type="number"
              value={form.seniority_rank ?? ''}
              onChange={e => set('seniority_rank', toNullableNumber(e.target.value))}
            />
          </div>
        </div>

        <label className={formStyles.checkboxRow}>
          <input
            type="checkbox"
            checked={form.is_lcg_position ?? false}
            onChange={e => set('is_lcg_position', e.target.checked)}
          />
          <span className={formStyles.label}>LCG Position</span>
        </label>

        {error && <div className={formStyles.error}>{error}</div>}

        <div className={formStyles.actions}>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Tranche'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
