import { useState } from 'react'
import { Button } from '@leontechrepo/leon-ui'
import { Modal } from '../ui/Modal/Modal'
import { Form, FormActions, FormError, FormRow, TextField } from '../ui/Form/Form'
import type { Company, CompanyInput } from '../../types'

type CompanyFormState = Partial<CompanyInput>

const EMPTY: CompanyFormState = {
  company_name: '',
  state: '',
  hq_location: '',
  sector: '',
  subsector: '',
}

interface Props {
  open: boolean
  onClose: () => void
  initial?: Company | null
  onSubmit: (body: Partial<CompanyInput>) => Promise<unknown>
}

export function CompanyFormModal({ open, onClose, initial, onSubmit }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Company' : 'New Company'}>
      <CompanyForm onClose={onClose} initial={initial} onSubmit={onSubmit} />
    </Modal>
  )
}

function CompanyForm({ onClose, initial, onSubmit }: Omit<Props, 'open'>) {
  const [form, setForm] = useState<CompanyFormState>(() => (initial ? { ...EMPTY, ...initial } : EMPTY))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEdit = !!initial

  function set<K extends keyof CompanyFormState>(key: K, value: CompanyFormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company_name?.trim()) {
      setError('Company name is required.')
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
      <TextField
        label="Company Name *"
        value={form.company_name ?? ''}
        onChange={e => set('company_name', e.target.value)}
      />

      <FormRow>
        <TextField label="Sector" value={form.sector ?? ''} onChange={e => set('sector', e.target.value)} />
        <TextField label="Subsector" value={form.subsector ?? ''} onChange={e => set('subsector', e.target.value)} />
      </FormRow>

      <FormRow>
        <TextField label="HQ Location" value={form.hq_location ?? ''} onChange={e => set('hq_location', e.target.value)} />
        <TextField label="State" value={form.state ?? ''} onChange={e => set('state', e.target.value)} />
      </FormRow>

      {error && <FormError>{error}</FormError>}

      <FormActions>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Company'}
        </Button>
      </FormActions>
    </Form>
  )
}
