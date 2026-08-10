import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal/Modal'
import { Button } from '../ui/Button/Button'
import type { Company, CompanyInput } from '../../types'
import formStyles from '../shared/Form.module.css'

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
  const [form, setForm] = useState<CompanyFormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEdit = !!initial

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...EMPTY, ...initial } : EMPTY)
      setError(null)
    }
  }, [open, initial])

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
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Company' : 'New Company'}>
      <form className={formStyles.form} onSubmit={handleSubmit}>
        <div className={formStyles.field}>
          <label className={formStyles.label}>Company Name *</label>
          <input
            className={formStyles.input}
            value={form.company_name ?? ''}
            onChange={e => set('company_name', e.target.value)}
          />
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Sector</label>
            <input className={formStyles.input} value={form.sector ?? ''} onChange={e => set('sector', e.target.value)} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Subsector</label>
            <input className={formStyles.input} value={form.subsector ?? ''} onChange={e => set('subsector', e.target.value)} />
          </div>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>HQ Location</label>
            <input className={formStyles.input} value={form.hq_location ?? ''} onChange={e => set('hq_location', e.target.value)} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>State</label>
            <input className={formStyles.input} value={form.state ?? ''} onChange={e => set('state', e.target.value)} />
          </div>
        </div>

        {error && <div className={formStyles.error}>{error}</div>}

        <div className={formStyles.actions}>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Company'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
