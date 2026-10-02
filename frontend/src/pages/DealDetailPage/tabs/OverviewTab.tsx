import { Link } from 'react-router-dom'
import { Card, CardTitle, Input, KeyValue, KeyValueGrid } from '@leontechrepo/leon-ui'
import { useDealContext } from '../dealContext'
import { usePatchDeal } from '../../../hooks/useDeals'
import { useCurrentActor } from '../../../hooks/useCurrentActor'
import { useToast } from '../../../components/Toast/Toast'
import { InlineEditText } from '../../../components/ui/InlineEditText/InlineEditText'
import { SelectInput } from '../../../components/ui/Form/Form'
import { FieldRow, FieldHint, ReadOnlyValue } from '../../../components/dealDetail/FieldRow'
import { PipelineStageBadge } from '../../../components/shared/PipelineStageBadge'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { TonedBadge } from '../../../components/ui/TonedBadge'
import { ndaTone } from '../../../domain/badgeTones'
import { fmtM } from '../../../domain/format'
import styles from './OverviewTab.module.css'

const NDA_STATUSES = ['Not Started', 'Sent', 'Signed']

function EditableSelect({ dealId, field, value, options }: {
  dealId: string
  field: string
  value: string | null
  options: readonly string[]
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
    <SelectInput value={value ?? ''} onChange={onChange} aria-label={field}>
      <option value="" disabled>—</option>
      {options.map(o => (
        <option key={o} value={o}>{o}</option>
      ))}
    </SelectInput>
  )
}

function EditableDate({ dealId, field, value }: { dealId: string; field: string; value: string | null }) {
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

  return <Input type="date" value={value ?? ''} onChange={onChange} aria-label={field} />
}

export function OverviewTab() {
  const { deal } = useDealContext()
  const patchMutation = usePatchDeal()
  const actor = useCurrentActor()

  function saveField(field: string) {
    return (value: string | null) => patchMutation.mutateAsync({ dealId: deal.id, field, value, actor })
  }

  return (
    <div className="detail-cards">
      <Card>
        <CardTitle>Snapshot</CardTitle>
        <KeyValueGrid>
          <KeyValue label="Stage" value={<PipelineStageBadge stage={deal.pipeline_stage} />} sub="Change from the header controls" />
          <KeyValue label="Status" value={<StatusBadge status={deal.status} />} />
          <KeyValue label="Deal Size" value={fmtM(deal.deal_size_m)} />
          <KeyValue label="Security" value={deal.security ?? '—'} />
          <KeyValue label="Target Close" value={deal.target_close ?? '—'} />
          <KeyValue
            label="Deal Team"
            value={deal.deal_team && deal.deal_team.length > 0 ? deal.deal_team.join(', ') : '—'}
          />
        </KeyValueGrid>
      </Card>

      <Card>
        <CardTitle>Company</CardTitle>
        <FieldRow label="Company Name"><InlineEditText value={deal.company_name} onSave={saveField('company_name')} /></FieldRow>
        <FieldRow label="Company Record">
          {deal.company_id ? (
            <Link to={`/companies?id=${deal.company_id}`} className={styles.companyLink}>View in Companies →</Link>
          ) : (
            <ReadOnlyValue>—</ReadOnlyValue>
          )}
        </FieldRow>
        <FieldRow label="Sector"><InlineEditText value={deal.sector_primary} onSave={saveField('sector_primary')} /></FieldRow>
        <FieldRow label="Sector (Full)"><InlineEditText value={deal.sector_full} onSave={saveField('sector_full')} /></FieldRow>
        <FieldRow label="Subsector"><InlineEditText value={deal.subsector} onSave={saveField('subsector')} /></FieldRow>
        <FieldRow label="Location"><InlineEditText value={deal.location} onSave={saveField('location')} /></FieldRow>
        <FieldRow label="State"><InlineEditText value={deal.state} onSave={saveField('state')} /></FieldRow>
        <FieldRow label="Employees"><InlineEditText value={deal.employees?.toString() ?? null} onSave={saveField('employees')} /></FieldRow>
        <FieldRow label="Locations"><InlineEditText value={deal.locations_count?.toString() ?? null} onSave={saveField('locations_count')} /></FieldRow>
        <FieldRow label="Year Founded"><InlineEditText value={deal.year_founded?.toString() ?? null} onSave={saveField('year_founded')} /></FieldRow>
      </Card>

      <Card>
        <CardTitle>Deal Terms</CardTitle>
        <FieldRow label="Deal Size ($M)">
          <ReadOnlyValue>{deal.deal_size_m !== null ? `$${deal.deal_size_m}M` : '—'}</ReadOnlyValue>
          <FieldHint>Edit on the Underwriting tab.</FieldHint>
        </FieldRow>
        <FieldRow label="Security"><ReadOnlyValue>{deal.security ?? '—'}</ReadOnlyValue></FieldRow>
        <FieldRow label="Use of Proceeds"><InlineEditText value={deal.uop} onSave={saveField('uop')} /></FieldRow>
        <FieldRow label="Source"><InlineEditText value={deal.source} onSave={saveField('source')} /></FieldRow>
      </Card>

      <Card>
        <CardTitle>Process &amp; Status</CardTitle>
        <FieldRow label="Sourcing Date"><EditableDate dealId={deal.id} field="sourcing_date" value={deal.sourcing_date} /></FieldRow>
        <FieldRow label="NDA Date"><EditableDate dealId={deal.id} field="nda_date" value={deal.nda_date} /></FieldRow>
        <FieldRow label="NDA Status">
          <div className={styles.inline}>
            <EditableSelect dealId={deal.id} field="nda_status" value={deal.nda_status} options={NDA_STATUSES} />
            {deal.nda_status && <TonedBadge tone={ndaTone(deal.nda_status)}>{deal.nda_status}</TonedBadge>}
          </div>
        </FieldRow>
        <FieldRow label="Contact Name"><InlineEditText value={deal.contact_name} onSave={saveField('contact_name')} /></FieldRow>
        <FieldRow label="Contact Role"><InlineEditText value={deal.contact_role} onSave={saveField('contact_role')} /></FieldRow>
        <FieldRow label="Target Close"><ReadOnlyValue>{deal.target_close ?? '—'}</ReadOnlyValue></FieldRow>
        <FieldRow label="Next Action">
          <InlineEditText value={deal.next_action} onSave={saveField('next_action')} multiline />
        </FieldRow>
        <FieldRow label="Legacy Milestones">
          <ReadOnlyValue>
            NDA: {deal.nda || '—'} · Dataroom: {deal.dataroom || '—'} · Mgmt Meeting: {deal.mgmt_meeting || '—'} · IOI Offered: {deal.ioi_offered || '—'} · IOI Signed: {deal.ioi_signed || '—'}
          </ReadOnlyValue>
        </FieldRow>
      </Card>

      <Card>
        <CardTitle>Commentary</CardTitle>
        <FieldRow label="Commentary">
          <InlineEditText value={deal.commentary} onSave={saveField('commentary')} multiline />
        </FieldRow>
        <FieldRow label="Reasons for Passing">
          <InlineEditText value={deal.reasons_for_passing} onSave={saveField('reasons_for_passing')} multiline />
        </FieldRow>
      </Card>
    </div>
  )
}
