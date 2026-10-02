import { useState } from 'react'
import { Button } from '@leontechrepo/leon-ui'
import { Modal } from '../ui/Modal/Modal'
import { Form, FormActions, FormError, SelectField, TextField } from '../ui/Form/Form'
import { DEAL_TEAM_ROLES } from '../../types'
import type { DealTeamMember, DealTeamMemberInput } from '../../types'

type FormState = Partial<DealTeamMemberInput>

const EMPTY: FormState = { team_member: '', role_on_deal: null }

interface Props {
  open: boolean
  onClose: () => void
  initial?: DealTeamMember | null
  onSubmit: (body: Partial<DealTeamMemberInput>) => Promise<unknown>
}

export function TeamMemberFormModal({ open, onClose, initial, onSubmit }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Team Member' : 'Add Team Member'}>
      <TeamMemberForm onClose={onClose} initial={initial} onSubmit={onSubmit} />
    </Modal>
  )
}

function TeamMemberForm({ onClose, initial, onSubmit }: Omit<Props, 'open'>) {
  const [form, setForm] = useState<FormState>(() => (initial ? { ...EMPTY, ...initial } : EMPTY))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEdit = !!initial

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.team_member?.trim()) {
      setError('Name is required.')
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
        label="Name *"
        value={form.team_member ?? ''}
        onChange={e => set('team_member', e.target.value)}
      />

      <SelectField
        label="Role on Deal"
        value={form.role_on_deal ?? ''}
        onChange={e => set('role_on_deal', (e.target.value || null) as FormState['role_on_deal'])}
      >
        <option value="">—</option>
        {DEAL_TEAM_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
      </SelectField>

      {error && <FormError>{error}</FormError>}

      <FormActions>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Team Member'}
        </Button>
      </FormActions>
    </Form>
  )
}
