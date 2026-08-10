import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal/Modal'
import { Button } from '../ui/Button/Button'
import type { ParticipantLender, ParticipantLenderInput } from '../../types'
import formStyles from '../shared/Form.module.css'

type FormState = Omit<Partial<ParticipantLenderInput>, 'participation_amount'> & { amountDollars: string }

const EMPTY: FormState = { lender_name: '', amountDollars: '', is_agent: false }

interface Props {
  open: boolean
  onClose: () => void
  initial?: ParticipantLender | null
  onSubmit: (body: Partial<ParticipantLenderInput>) => Promise<unknown>
}

export function ParticipantLenderFormModal({ open, onClose, initial, onSubmit }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEdit = !!initial

  useEffect(() => {
    if (open) {
      setForm(initial
        ? { ...EMPTY, ...initial, amountDollars: initial.participation_amount !== null ? String(initial.participation_amount / 100) : '' }
        : EMPTY)
      setError(null)
    }
  }, [open, initial])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.lender_name?.trim()) {
      setError('Lender name is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const { amountDollars, ...rest } = form
      const participation_amount = amountDollars.trim() === '' ? null : Math.round(Number(amountDollars) * 100)
      await onSubmit({ ...rest, participation_amount })
      onClose()
    } catch {
      setError('Save failed — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Participant Lender' : 'Add Participant Lender'}>
      <form className={formStyles.form} onSubmit={handleSubmit}>
        <div className={formStyles.field}>
          <label className={formStyles.label}>Lender Name *</label>
          <input
            className={formStyles.input}
            value={form.lender_name ?? ''}
            onChange={e => set('lender_name', e.target.value)}
          />
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>Participation Amount ($)</label>
          <input
            className={formStyles.input}
            type="number"
            step="any"
            value={form.amountDollars}
            onChange={e => set('amountDollars', e.target.value)}
          />
        </div>

        <label className={formStyles.checkboxRow}>
          <input type="checkbox" checked={form.is_agent ?? false} onChange={e => set('is_agent', e.target.checked)} />
          <span className={formStyles.label}>Agent</span>
        </label>

        {error && <div className={formStyles.error}>{error}</div>}

        <div className={formStyles.actions}>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Lender'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
