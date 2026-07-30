import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal/Modal'
import { Button } from '../ui/Button/Button'
import type { Sponsor, SponsorInput } from '../../types'
import formStyles from '../shared/Form.module.css'

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

function toNullableNumber(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

export function SponsorFormModal({ open, onClose, initial, onSubmit }: Props) {
  const [form, setForm] = useState<SponsorFormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEdit = !!initial

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...EMPTY, ...initial } : EMPTY)
      setError(null)
    }
  }, [open, initial])

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

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Sponsor' : 'New Sponsor'}>
      <form className={formStyles.form} onSubmit={handleSubmit}>
        <div className={formStyles.field}>
          <label className={formStyles.label}>Name *</label>
          <input className={formStyles.input} value={form.name ?? ''} onChange={e => set('name', e.target.value)} />
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Sponsor Type</label>
            <select
              className={formStyles.select}
              value={form.sponsor_type ?? ''}
              onChange={e => set('sponsor_type', (e.target.value || null) as SponsorFormState['sponsor_type'])}
            >
              <option value="">—</option>
              <option value="PE Sponsor">PE Sponsor</option>
              <option value="Strategic">Strategic</option>
            </select>
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>AUM ($M)</label>
            <input
              className={formStyles.input}
              type="number"
              value={form.aum_m ?? ''}
              onChange={e => set('aum_m', toNullableNumber(e.target.value))}
            />
          </div>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Focus</label>
            <input className={formStyles.input} value={form.focus ?? ''} onChange={e => set('focus', e.target.value)} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>HQ Location</label>
            <input className={formStyles.input} value={form.hq_location ?? ''} onChange={e => set('hq_location', e.target.value)} />
          </div>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Fund Vintage</label>
            <input className={formStyles.input} value={form.fund_vintage ?? ''} onChange={e => set('fund_vintage', e.target.value)} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Email Domain</label>
            <input className={formStyles.input} value={form.email_domain ?? ''} onChange={e => set('email_domain', e.target.value)} placeholder="acme.com" />
          </div>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Contact Name</label>
            <input className={formStyles.input} value={form.contact_name ?? ''} onChange={e => set('contact_name', e.target.value)} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Contact Role</label>
            <input className={formStyles.input} value={form.contact_role ?? ''} onChange={e => set('contact_role', e.target.value)} />
          </div>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Contact Email</label>
            <input className={formStyles.input} type="email" value={form.contact_email ?? ''} onChange={e => set('contact_email', e.target.value)} />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Contact Phone</label>
            <input className={formStyles.input} value={form.contact_phone ?? ''} onChange={e => set('contact_phone', e.target.value)} />
          </div>
        </div>

        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Coverage Cadence</label>
            <input className={formStyles.input} value={form.coverage_cadence ?? ''} onChange={e => set('coverage_cadence', e.target.value)} placeholder="Monthly" />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Last Contact Date</label>
            <input
              className={formStyles.input}
              type="date"
              value={form.last_contact_date ?? ''}
              onChange={e => set('last_contact_date', e.target.value || null)}
            />
          </div>
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>Relationship Note</label>
          <textarea className={formStyles.textarea} value={form.relationship_note ?? ''} onChange={e => set('relationship_note', e.target.value)} />
        </div>

        {error && <div className={formStyles.error}>{error}</div>}

        <div className={formStyles.actions}>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Sponsor'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
