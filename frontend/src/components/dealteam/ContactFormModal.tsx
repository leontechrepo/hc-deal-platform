import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal/Modal'
import { Button } from '../ui/Button/Button'
import { SearchableSelect } from '../ui/SearchableSelect/SearchableSelect'
import { useCompanies } from '../../hooks/useCompanies'
import { CONTACT_ROLES } from '../../types'
import type { Contact, ContactInput, ContactPatchInput } from '../../types'
import formStyles from '../shared/Form.module.css'

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
  const { data: companies = [] } = useCompanies()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEdit = !!initial

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...EMPTY, ...initial } : { ...EMPTY, company_id: defaultCompanyId ?? null })
      setError(null)
    }
  }, [open, initial, defaultCompanyId])

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
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Contact' : 'Add Contact'}>
      <form className={formStyles.form} onSubmit={handleSubmit}>
        <div className={formStyles.field}>
          <label className={formStyles.label}>Name *</label>
          <input className={formStyles.input} value={form.name ?? ''} onChange={e => set('name', e.target.value)} />
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Role</label>
            <select
              className={formStyles.select}
              value={form.role ?? ''}
              onChange={e => set('role', (e.target.value || null) as FormState['role'])}
            >
              <option value="">—</option>
              {CONTACT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Email</label>
            <input className={formStyles.input} type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)} />
          </div>
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>Company</label>
          {isEdit ? (
            <>
              <input
                className={formStyles.input}
                value={companies.find(c => c.company_id === form.company_id)?.company_name ?? '—'}
                disabled
              />
              <span className={formStyles.lockedNote}>Company can only be set when a contact is created.</span>
            </>
          ) : (
            <SearchableSelect
              options={companies.map(c => ({ id: c.company_id, label: c.company_name }))}
              value={form.company_id ?? null}
              onChange={id => set('company_id', id)}
              placeholder="Search companies…"
            />
          )}
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Last Interaction</label>
            <input
              className={formStyles.input}
              type="date"
              value={form.last_interaction_date ?? ''}
              onChange={e => set('last_interaction_date', e.target.value || null)}
            />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Next Touchpoint Due</label>
            <input
              className={formStyles.input}
              type="date"
              value={form.next_touchpoint_due ?? ''}
              onChange={e => set('next_touchpoint_due', e.target.value || null)}
            />
          </div>
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>Cadence Frequency</label>
          <input
            className={formStyles.input}
            value={form.cadence_frequency ?? ''}
            onChange={e => set('cadence_frequency', e.target.value)}
            placeholder="Monthly"
          />
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>Draft Follow-up Ref</label>
          <input
            className={formStyles.input}
            value={form.draft_followup_ref ?? ''}
            onChange={e => set('draft_followup_ref', e.target.value)}
          />
        </div>

        {error && <div className={formStyles.error}>{error}</div>}

        <div className={formStyles.actions}>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Contact'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
