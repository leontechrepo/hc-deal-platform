import { useId, useState } from 'react'
import { Button, Field, FieldLabel } from '@leontechrepo/leon-ui'
import { Modal } from '../ui/Modal/Modal'
import { Form, FormActions, FormError, TextField } from '../ui/Form/Form'
import type { ParticipantLender, ParticipantLenderInput } from '../../types'

type FormState = Omit<Partial<ParticipantLenderInput>, 'participation_amount'> & { amountDollars: string }

const EMPTY: FormState = { lender_name: '', amountDollars: '', is_agent: false }

interface Props {
  open: boolean
  onClose: () => void
  initial?: ParticipantLender | null
  onSubmit: (body: Partial<ParticipantLenderInput>) => Promise<unknown>
}

export function ParticipantLenderFormModal({ open, onClose, initial, onSubmit }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Participant Lender' : 'Add Participant Lender'}>
      <LenderForm onClose={onClose} initial={initial} onSubmit={onSubmit} />
    </Modal>
  )
}

function LenderForm({ onClose, initial, onSubmit }: Omit<Props, 'open'>) {
  const [form, setForm] = useState<FormState>(() =>
    initial
      ? { ...EMPTY, ...initial, amountDollars: initial.participation_amount !== null ? String(initial.participation_amount / 100) : '' }
      : EMPTY,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const agentId = useId()
  const isEdit = !!initial

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
    <Form onSubmit={handleSubmit}>
      <TextField
        label="Lender Name *"
        value={form.lender_name ?? ''}
        onChange={e => set('lender_name', e.target.value)}
      />

      <TextField
        label="Participation Amount ($)"
        type="number"
        step="any"
        value={form.amountDollars}
        onChange={e => set('amountDollars', e.target.value)}
      />

      <Field orientation="horizontal">
        <input
          id={agentId}
          type="checkbox"
          checked={form.is_agent ?? false}
          onChange={e => set('is_agent', e.target.checked)}
        />
        <FieldLabel htmlFor={agentId}>Agent</FieldLabel>
      </Field>

      {error && <FormError>{error}</FormError>}

      <FormActions>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Lender'}
        </Button>
      </FormActions>
    </Form>
  )
}
