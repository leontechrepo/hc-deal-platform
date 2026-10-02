import { useState } from 'react'
import { Button } from '@leontechrepo/leon-ui'
import { Modal } from '../ui/Modal/Modal'
import { Form, FormActions, FormError, FormRow, SelectField, TextareaField, TextField } from '../ui/Form/Form'
import { toNullableNumber } from '../../domain/format'
import type { Sponsor, SponsorInput } from '../../types'

type SponsorFormState = Partial<SponsorInput>

const EMPTY: SponsorFormState = {
  name: '',
  sponsor_type: null,
  aum_m: null,
  focus: '',
  hq_location: '',
  fund_vintage: '',
  contact_name: '',
  contact_role: '',
  contact_email: '',
  contact_phone: '',
  email_domain: '',
  coverage_cadence: '',
  last_contact_date: null,
  relationship_note: '',
}

interface Props {
  open: boolean
  onClose: () => void
  initial?: Sponsor | null
  onSubmit: (body: Partial<SponsorInput>) => Promise<unknown>
}

export function SponsorFormModal({ open, onClose, initial, onSubmit }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Sponsor' : 'New Sponsor'}>
      <SponsorForm onClose={onClose} initial={initial} onSubmit={onSubmit} />
    </Modal>
  )
}

function SponsorForm({ onClose, initial, onSubmit }: Omit<Props, 'open'>) {
  const [form, setForm] = useState<SponsorFormState>(() => (initial ? { ...EMPTY, ...initial } : EMPTY))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEdit = !!initial

  function set<K extends keyof SponsorFormState>(key: K, value: SponsorFormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name?.trim()) {
      setError('Sponsor name is required.')
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

  const txt = (key: keyof SponsorFormState) => ({
    value: (form[key] as string | null | undefined) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, e.target.value as never),
  })

  return (
    <Form onSubmit={handleSubmit}>
      <TextField label="Name *" {...txt('name')} />

      <FormRow>
        <SelectField
          label="Sponsor Type"
          value={form.sponsor_type ?? ''}
          onChange={e => set('sponsor_type', (e.target.value || null) as SponsorFormState['sponsor_type'])}
        >
          <option value="">—</option>
          <option value="PE Sponsor">PE Sponsor</option>
          <option value="Strategic">Strategic</option>
        </SelectField>
        <TextField
          label="AUM ($M)"
          type="number"
          step="any"
          value={form.aum_m ?? ''}
          onChange={e => set('aum_m', toNullableNumber(e.target.value))}
        />
      </FormRow>

      <FormRow>
        <TextField label="Focus" {...txt('focus')} />
        <TextField label="HQ Location" {...txt('hq_location')} />
      </FormRow>

      <FormRow>
        <TextField label="Fund Vintage" {...txt('fund_vintage')} />
        <TextField label="Email Domain" {...txt('email_domain')} placeholder="acme.com" />
      </FormRow>

      <FormRow>
        <TextField label="Contact Name" {...txt('contact_name')} />
        <TextField label="Contact Role" {...txt('contact_role')} />
      </FormRow>

      <FormRow>
        <TextField label="Contact Email" type="email" {...txt('contact_email')} />
        <TextField label="Contact Phone" {...txt('contact_phone')} />
      </FormRow>

      <FormRow>
        <TextField label="Coverage Cadence" {...txt('coverage_cadence')} placeholder="Monthly" />
        <TextField
          label="Last Contact Date"
          type="date"
          value={form.last_contact_date ?? ''}
          onChange={e => set('last_contact_date', e.target.value || null)}
        />
      </FormRow>

      <TextareaField
        label="Relationship Note"
        value={form.relationship_note ?? ''}
        onChange={e => set('relationship_note', e.target.value)}
      />

      {error && <FormError>{error}</FormError>}

      <FormActions>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Sponsor'}
        </Button>
      </FormActions>
    </Form>
  )
}
