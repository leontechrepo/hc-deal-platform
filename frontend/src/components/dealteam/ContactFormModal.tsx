import { useState } from 'react'
import { Button, Field, FieldLabel, Input, SearchableSelect } from '@leontechrepo/leon-ui'
import { Modal } from '../ui/Modal/Modal'
import { Form, FormActions, FormError, FormRow, SelectField, TextField } from '../ui/Form/Form'
import { useCompanies } from '../../hooks/useCompanies'
import { CONTACT_ROLES } from '../../types'
import type { Contact, ContactInput, ContactPatchInput } from '../../types'

type FormState = Partial<ContactInput>

const EMPTY: FormState = {
  company_id: null,
  name: '',
  email: '',
  role: null,
  cadence_frequency: '',
  last_interaction_date: null,
  next_touchpoint_due: null,
  draft_followup_ref: '',
}

interface Props {
  open: boolean
  onClose: () => void
  initial?: Contact | null
  defaultCompanyId?: string | null
  onSubmit: (body: Partial<ContactInput> | ContactPatchInput) => Promise<unknown>
}

export function ContactFormModal({ open, onClose, initial, defaultCompanyId, onSubmit }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Contact' : 'Add Contact'}>
      <ContactForm onClose={onClose} initial={initial} defaultCompanyId={defaultCompanyId} onSubmit={onSubmit} />
    </Modal>
  )
}

function ContactForm({ onClose, initial, defaultCompanyId, onSubmit }: Omit<Props, 'open'>) {
  const { data: companies = [] } = useCompanies()
  const [form, setForm] = useState<FormState>(() =>
    initial ? { ...EMPTY, ...initial } : { ...EMPTY, company_id: defaultCompanyId ?? null },
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEdit = !!initial

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name?.trim()) {
      setError('Name is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (isEdit) {
        const { company_id, sponsor_id, deal_id, ...patchable } = form
        void company_id; void sponsor_id; void deal_id
        await onSubmit(patchable)
      } else {
        await onSubmit(form)
      }
      onClose()
    } catch {
      setError('Save failed — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form onSubmit={handleSubmit}>
      <TextField label="Name *" value={form.name ?? ''} onChange={e => set('name', e.target.value)} />

      <FormRow>
        <SelectField
          label="Role"
          value={form.role ?? ''}
          onChange={e => set('role', (e.target.value || null) as FormState['role'])}
        >
          <option value="">—</option>
          {CONTACT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </SelectField>
        <TextField label="Email" type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)} />
      </FormRow>

      <Field>
        <FieldLabel>Company</FieldLabel>
        {isEdit ? (
          <>
            <Input
              value={companies.find(c => c.company_id === form.company_id)?.company_name ?? '—'}
              disabled
              aria-label="Company"
            />
            <span className="field-sub">Company can only be set when a contact is created.</span>
          </>
        ) : (
          <SearchableSelect
            options={companies.map(c => ({ id: c.company_id, label: c.company_name }))}
            value={form.company_id ?? null}
            onChange={id => set('company_id', id)}
            placeholder="Search companies…"
            noneLabel="None"
          />
        )}
      </Field>

      <FormRow>
        <TextField
          label="Last Interaction"
          type="date"
          value={form.last_interaction_date ?? ''}
          onChange={e => set('last_interaction_date', e.target.value || null)}
        />
        <TextField
          label="Next Touchpoint Due"
          type="date"
          value={form.next_touchpoint_due ?? ''}
          onChange={e => set('next_touchpoint_due', e.target.value || null)}
        />
      </FormRow>

      <TextField
        label="Cadence Frequency"
        value={form.cadence_frequency ?? ''}
        onChange={e => set('cadence_frequency', e.target.value)}
        placeholder="Monthly"
      />

      <TextField
        label="Draft Follow-up Ref"
        value={form.draft_followup_ref ?? ''}
        onChange={e => set('draft_followup_ref', e.target.value)}
      />

      {error && <FormError>{error}</FormError>}

      <FormActions>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Contact'}
        </Button>
      </FormActions>
    </Form>
  )
}
