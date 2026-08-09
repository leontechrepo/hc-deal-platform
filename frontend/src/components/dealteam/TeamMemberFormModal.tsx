import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal/Modal'
import { Button } from '../ui/Button/Button'
import { DEAL_TEAM_ROLES } from '../../types'
import type { DealTeamMember, DealTeamMemberInput } from '../../types'
import formStyles from '../shared/Form.module.css'

type FormState = Partial<DealTeamMemberInput>

const EMPTY: FormState = { team_member: '', role_on_deal: null }

interface Props {
  open: boolean
  onClose: () => void
  initial?: DealTeamMember | null
  onSubmit: (body: Partial<DealTeamMemberInput>) => Promise<unknown>
}

export function TeamMemberFormModal({ open, onClose, initial, onSubmit }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEdit = !!initial

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...EMPTY, ...initial } : EMPTY)
      setError(null)
    }
  }, [open, initial])

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
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Team Member' : 'Add Team Member'}>
      <form className={formStyles.form} onSubmit={handleSubmit}>
        <div className={formStyles.field}>
          <label className={formStyles.label}>Name *</label>
          <input
            className={formStyles.input}
            value={form.team_member ?? ''}
            onChange={e => set('team_member', e.target.value)}
          />
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>Role on Deal</label>
          <select
            className={formStyles.select}
            value={form.role_on_deal ?? ''}
            onChange={e => set('role_on_deal', (e.target.value || null) as FormState['role_on_deal'])}
          >
            <option value="">—</option>
            {DEAL_TEAM_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {error && <div className={formStyles.error}>{error}</div>}

        <div className={formStyles.actions}>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Team Member'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
