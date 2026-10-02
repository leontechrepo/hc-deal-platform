import { useState } from 'react'
import { Button } from '@leontechrepo/leon-ui'
import { Modal } from '../ui/Modal/Modal'
import { Form, FormActions, FormError, FormRow, TextField } from '../ui/Form/Form'
import { toNullableNumber } from '../../domain/format'
import type { FundLP, FundLPInput } from '../../types'

const EMPTY: FundLPInput = { name: '', commitment_m: null, called_m: null }

interface Props {
  open: boolean
  onClose: () => void
  initial?: FundLP | null
  onSubmit: (body: FundLPInput) => Promise<unknown>
}

export function LPFormModal({ open, onClose, initial, onSubmit }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit LP' : 'Add LP'}>
      <LPForm onClose={onClose} initial={initial} onSubmit={onSubmit} />
    </Modal>
  )
}

function LPForm({ onClose, initial, onSubmit }: Omit<Props, 'open'>) {
  const [form, setForm] = useState<FundLPInput>(() =>
    initial ? { name: initial.name, commitment_m: initial.commitment_m, called_m: initial.called_m } : EMPTY,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEdit = !!initial

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
    <Form onSubmit={handleSubmit}>
      <TextField label="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      <FormRow>
        <TextField
          label="Commitment ($M)"
          type="number"
          step="any"
          value={form.commitment_m ?? ''}
          onChange={e => setForm(f => ({ ...f, commitment_m: toNullableNumber(e.target.value) }))}
        />
        <TextField
          label="Called ($M)"
          type="number"
          step="any"
          value={form.called_m ?? ''}
          onChange={e => setForm(f => ({ ...f, called_m: toNullableNumber(e.target.value) }))}
        />
      </FormRow>

      {error && <FormError>{error}</FormError>}

      <FormActions>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add LP'}
        </Button>
      </FormActions>
    </Form>
  )
}
