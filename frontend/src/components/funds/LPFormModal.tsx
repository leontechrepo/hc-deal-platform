import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal/Modal'
import { Button } from '../ui/Button/Button'
import type { FundLP, FundLPInput } from '../../types'
import formStyles from '../shared/Form.module.css'

const EMPTY: FundLPInput = { name: '', commitment_m: null, called_m: null }

interface Props {
  open: boolean
  onClose: () => void
  initial?: FundLP | null
  onSubmit: (body: FundLPInput) => Promise<unknown>
}

function toNullableNumber(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

export function LPFormModal({ open, onClose, initial, onSubmit }: Props) {
  const [form, setForm] = useState<FundLPInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEdit = !!initial

  useEffect(() => {
    if (open) {
      setForm(initial ? { name: initial.name, commitment_m: initial.commitment_m, called_m: initial.called_m } : EMPTY)
      setError(null)
    }
  }, [open, initial])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('LP name is required.')
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
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit LP' : 'Add LP'}>
      <form className={formStyles.form} onSubmit={handleSubmit} style={{ minWidth: 320 }}>
        <div className={formStyles.field}>
          <label className={formStyles.label}>Name *</label>
          <input className={formStyles.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Commitment ($M)</label>
            <input
              className={formStyles.input}
              type="number"
              step="any"
              value={form.commitment_m ?? ''}
              onChange={e => setForm(f => ({ ...f, commitment_m: toNullableNumber(e.target.value) }))}
            />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Called ($M)</label>
            <input
              className={formStyles.input}
              type="number"
              step="any"
              value={form.called_m ?? ''}
              onChange={e => setForm(f => ({ ...f, called_m: toNullableNumber(e.target.value) }))}
            />
          </div>
        </div>

        {error && <div className={formStyles.error}>{error}</div>}

        <div className={formStyles.actions}>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add LP'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
