import { useOutletContext } from 'react-router-dom'
import { usePatchDeal } from '../../../hooks/useDeals'
import { useCurrentActor } from '../../../hooks/useCurrentActor'
import { useToast } from '../../../components/Toast/Toast'
import { InlineEditText } from '../../../components/ui/InlineEditText/InlineEditText'
import { PIPELINE_STAGES, formatPipelineStage } from '../../../components/shared/PipelineStageBadge'
import { STATUSES } from '../../../components/shared/StatusBadge'
import type { Deal } from '../../../types'
import formStyles from '../../../components/shared/Form.module.css'
import styles from './OverviewTab.module.css'

const NDA_STATUSES = ['Not Started', 'Sent', 'Signed']

function EditableSelect({ dealId, field, value, options, labelFor }: {
  dealId: number
  field: string
  value: string | null
  options: readonly string[]
  labelFor?: (v: string) => string
}) {
  const patchMutation = usePatchDeal()
  const actor = useCurrentActor()
  const { showToast } = useToast()

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    try {
      await patchMutation.mutateAsync({ dealId, field, value: e.target.value, actor })
      showToast('Saved')
    } catch {
      showToast('Save failed', true)
    }
  }

  return (
    <select className={formStyles.select} value={value ?? ''} onChange={onChange}>
      <option value="" disabled>—</option>
      {options.map(o => (
        <option key={o} value={o}>{labelFor ? labelFor(o) : o}</option>
      ))}
    </select>
  )
}

function EditableDate({ dealId, field, value }: { dealId: number; field: string; value: string | null }) {
  const patchMutation = usePatchDeal()
  const actor = useCurrentActor()
  const { showToast } = useToast()

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      await patchMutation.mutateAsync({ dealId, field, value: e.target.value || null, actor })
      showToast('Saved')
    } catch {
      showToast('Save failed', true)
    }
  }

  return <input type="date" className={formStyles.input} value={value ?? ''} onChange={onChange} />
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <div className={styles.fieldValue}>{children}</div>
    </div>
  )
}

export function OverviewTab() {
  const { deal } = useOutletContext<{ deal: Deal }>()
  const patchMutation = usePatchDeal()
  const actor = useCurrentActor()

  function saveField(field: string) {
    return (value: string | null) => patchMutation.mutateAsync({ dealId: deal.id, field, value, actor })
  }

  return (
    <div className={styles.tab}>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Company</h2>
        <Field label="Company Name"><InlineEditText value={deal.company_name} onSave={saveField('company_name')} /></Field>
        <Field label="Sector"><InlineEditText value={deal.sector_primary} onSave={saveField('sector_primary')} /></Field>
        <Field label="Sector (Full)"><InlineEditText value={deal.sector_full} onSave={saveField('sector_full')} /></Field>
        <Field label="Subsector"><InlineEditText value={deal.subsector} onSave={saveField('subsector')} /></Field>
        <Field label="Location"><InlineEditText value={deal.location} onSave={saveField('location')} /></Field>
        <Field label="State"><InlineEditText value={deal.state} onSave={saveField('state')} /></Field>
        <Field label="Employees"><InlineEditText value={deal.employees?.toString() ?? null} onSave={saveField('employees')} /></Field>
        <Field label="Locations"><InlineEditText value={deal.locations_count?.toString() ?? null} onSave={saveField('locations_count')} /></Field>
        <Field label="Year Founded"><InlineEditText value={deal.year_founded?.toString() ?? null} onSave={saveField('year_founded')} /></Field>
        <Field label="Deal Team">
          <span className={styles.readOnly}>{deal.deal_team && deal.deal_team.length > 0 ? deal.deal_team.join(', ') : '—'}</span>
        </Field>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Deal Terms</h2>
        <Field label="Deal Size ($M)">
          <span className={styles.readOnly}>{deal.deal_size_m !== null ? `$${deal.deal_size_m}M` : '—'}</span>
        </Field>
        <Field label="Security">
          <span className={styles.readOnly}>{deal.security ?? '—'}</span>
        </Field>
        <Field label="Use of Proceeds"><InlineEditText value={deal.uop} onSave={saveField('uop')} /></Field>
        <Field label="Source"><InlineEditText value={deal.source} onSave={saveField('source')} /></Field>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Process &amp; Status</h2>
        <Field label="Pipeline Stage">
          <EditableSelect
            dealId={deal.id}
            field="pipeline_stage"
            value={deal.pipeline_stage}
            options={PIPELINE_STAGES}
            labelFor={s => formatPipelineStage(s) ?? s}
          />
        </Field>
        <Field label="Status">
          <EditableSelect dealId={deal.id} field="status" value={deal.status} options={STATUSES} />
        </Field>
        <Field label="Sourcing Date"><EditableDate dealId={deal.id} field="sourcing_date" value={deal.sourcing_date} /></Field>
        <Field label="NDA Date"><EditableDate dealId={deal.id} field="nda_date" value={deal.nda_date} /></Field>
        <Field label="NDA Status">
          <EditableSelect dealId={deal.id} field="nda_status" value={deal.nda_status} options={NDA_STATUSES} />
        </Field>
        <Field label="Contact Name"><InlineEditText value={deal.contact_name} onSave={saveField('contact_name')} /></Field>
        <Field label="Contact Role"><InlineEditText value={deal.contact_role} onSave={saveField('contact_role')} /></Field>
        <Field label="Target Close">
          <span className={styles.readOnly}>{deal.target_close ?? '—'}</span>
        </Field>
        <Field label="Next Action">
          <InlineEditText value={deal.next_action} onSave={saveField('next_action')} multiline />
        </Field>
        <Field label="Legacy Milestones">
          <span className={styles.readOnly}>
            NDA: {deal.nda || '—'} · Dataroom: {deal.dataroom || '—'} · Mgmt Meeting: {deal.mgmt_meeting || '—'} · IOI Offered: {deal.ioi_offered || '—'} · IOI Signed: {deal.ioi_signed || '—'}
          </span>
        </Field>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Commentary</h2>
        <Field label="Commentary">
          <InlineEditText value={deal.commentary} onSave={saveField('commentary')} multiline />
        </Field>
        <Field label="Reasons for Passing">
          <InlineEditText value={deal.reasons_for_passing} onSave={saveField('reasons_for_passing')} multiline />
        </Field>
      </section>
    </div>
  )
}
