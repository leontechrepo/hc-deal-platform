import { useState } from 'react'
import { Button } from '@leontechrepo/leon-ui'
import { Modal } from '../ui/Modal/Modal'
import { Form, FormActions, FormError, FormRow, FormSection, SelectField, TextareaField, TextField } from '../ui/Form/Form'
import { toNullableNumber } from '../../domain/format'
import { PIPELINE_STAGES, STATUSES, TERMINAL_STATUSES, classifyMove, formatPipelineStage } from '../../domain/stages'
import { useCurrentActor } from '../../hooks/useCurrentActor'
import { useToast } from '../../components/Toast/Toast'
import type { CreateDealInput, Deal } from '../../types'

const EMPTY: CreateDealInput = {
  company_name: '',
  location: '',
  sector_primary: '',
  sector_full: '',
  subsector: '',
  security: '',
  uop: '',
  source: '',
  state: '',
  contact_name: '',
  contact_role: '',
  employees: null,
  locations_count: null,
  year_founded: null,
  deal_size_m: null,
  hold_amount_m: null,
  tenor_months: null,
  oid_pct: null,
  spread_bps: null,
  sofr_rate: null,
  sofr_floor_pct: null,
  ltm_revenue_m: null,
  ltm_ebitda_m: null,
  capex_m: null,
  ebitda_margin: null,
  revenue_growth_pct: null,
  max_leverage_covenant: null,
  min_fccr_covenant: null,
  capex_limit_covenant_m: null,
  pipeline_stage: 'sourcing',
  status: 'Active',
}

// Fields that drive the credit model — read-only once a deal's
// underwriting_locked flag is true (mirrors app/domain/pipeline_stage.py's
// UNDERWRITING_FIELDS, restricted to the subset this form actually renders).
const UNDERWRITING_FIELDS = new Set<keyof CreateDealInput>([
  'deal_size_m', 'security', 'hold_amount_m', 'tenor_months', 'oid_pct',
  'spread_bps', 'sofr_rate', 'sofr_floor_pct', 'ltm_revenue_m', 'ltm_ebitda_m',
  'capex_m', 'ebitda_margin', 'revenue_growth_pct', 'max_leverage_covenant',
  'min_fccr_covenant', 'capex_limit_covenant_m',
])

interface Props {
  open: boolean
  onClose: () => void
  initial?: Deal | null
  onSubmit: (body: Partial<CreateDealInput> & { reasoning?: string }) => Promise<unknown>
}

// Explicit pick rather than spreading Deal into CreateDealInput — Deal has
// far more fields than this form renders, and a couple (pipeline_stage,
// status) are typed nullable on Deal but non-nullable-optional here, so a
// plain spread doesn't type-check and would silently carry over unrelated
// Deal-only fields (id, bucket, ...) into form state.
function dealToFormInput(deal: Deal): CreateDealInput {
  return {
    company_name: deal.company_name,
    location: deal.location,
    sector_primary: deal.sector_primary,
    sector_full: deal.sector_full,
    subsector: deal.subsector,
    security: deal.security,
    uop: deal.uop,
    source: deal.source,
    state: deal.state,
    contact_name: deal.contact_name,
    contact_role: deal.contact_role,
    employees: deal.employees,
    locations_count: deal.locations_count,
    year_founded: deal.year_founded,
    deal_size_m: deal.deal_size_m,
    hold_amount_m: deal.hold_amount_m,
    tenor_months: deal.tenor_months,
    oid_pct: deal.oid_pct,
    spread_bps: deal.spread_bps,
    sofr_rate: deal.sofr_rate,
    sofr_floor_pct: deal.sofr_floor_pct,
    ltm_revenue_m: deal.ltm_revenue_m,
    ltm_ebitda_m: deal.ltm_ebitda_m,
    capex_m: deal.capex_m,
    ebitda_margin: deal.ebitda_margin,
    revenue_growth_pct: deal.revenue_growth_pct,
    max_leverage_covenant: deal.max_leverage_covenant,
    min_fccr_covenant: deal.min_fccr_covenant,
    capex_limit_covenant_m: deal.capex_limit_covenant_m,
    base_rate: deal.base_rate,
    pipeline_stage: deal.pipeline_stage ?? 'sourcing',
    status: deal.status ?? 'Active',
  }
}

export function DealFormModal({ open, onClose, initial, onSubmit }: Props) {
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Deal' : 'New Deal'}>
      <DealForm onClose={onClose} initial={initial} onSubmit={onSubmit} />
    </Modal>
  )
}

function DealForm({ onClose, initial, onSubmit }: Omit<Props, 'open'>) {
  const [form, setForm] = useState<CreateDealInput>(() => (initial ? dealToFormInput(initial) : EMPTY))
  const [reasoning, setReasoning] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const actor = useCurrentActor()
  const { showToast } = useToast()
  const isEdit = !!initial
  const locked = initial?.underwriting_locked ?? false
  // Only editing an existing deal can trigger the backend's terminal-status
  // reasoning requirement — create_deal has no such check, and a brand new
  // deal defaulting to "Active" never lands on a terminal value anyway.
  const statusChangingToTerminal = isEdit && TERMINAL_STATUSES.has(form.status ?? '') && form.status !== initial?.status
  // A forward jump over two or more funnel stages needs a recorded reason.
  const stageMove = isEdit && form.pipeline_stage ? classifyMove(initial?.pipeline_stage, form.pipeline_stage) : null
  const skippedStages = stageMove?.kind === 'skip' ? stageMove.skipped : []
  const needsReasoning = statusChangingToTerminal || skippedStages.length > 0

  function set<K extends keyof CreateDealInput>(key: K, value: CreateDealInput[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function isLocked(field: keyof CreateDealInput): boolean {
    return locked && UNDERWRITING_FIELDS.has(field)
  }

  const txt = (key: keyof CreateDealInput, extra: { lockable?: boolean } = {}) => ({
    value: (form[key] as string | null | undefined) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, e.target.value as never),
    disabled: extra.lockable ? isLocked(key) : undefined,
  })
  const num = (key: keyof CreateDealInput, lockable = false) => ({
    type: 'number' as const,
    step: 'any',
    value: (form[key] as number | null | undefined) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, toNullableNumber(e.target.value) as never),
    disabled: lockable ? isLocked(key) : undefined,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company_name.trim()) {
      setError('Company name is required.')
      return
    }
    if (needsReasoning && !reasoning.trim()) {
      setError(
        statusChangingToTerminal
          ? `Reasoning is required when moving status to ${form.status}.`
          : `Reasoning is required when skipping ${skippedStages.length} stage${skippedStages.length === 1 ? '' : 's'}.`,
      )
      return
    }
    setError(null)
    setSaving(true)
    try {
      await onSubmit({ ...form, actor, reasoning: reasoning.trim() || undefined })
      showToast(isEdit ? `Deal updated: ${form.company_name}` : `New deal added: ${form.company_name}`)
      onClose()
    } catch {
      setError('Save failed — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form onSubmit={handleSubmit}>
      <TextField label="Company Name *" autoFocus {...txt('company_name')} />

      <FormSection>Company &amp; Contact</FormSection>

      <FormRow>
        <TextField label="Location" {...txt('location')} />
        <TextField label="State" {...txt('state')} />
      </FormRow>

      <FormRow>
        <TextField label="Sector (Primary)" {...txt('sector_primary')} />
        <TextField label="Subsector" {...txt('subsector')} />
      </FormRow>

      <FormRow>
        <TextField label="Sector (Full)" {...txt('sector_full')} />
        <TextField label="Source" {...txt('source')} />
      </FormRow>

      <FormRow>
        <TextField label="Contact Name" {...txt('contact_name')} />
        <TextField label="Contact Role" {...txt('contact_role')} />
      </FormRow>

      <FormRow>
        <TextField label="Employees" {...num('employees')} />
        <TextField label="Locations" {...num('locations_count')} />
        <TextField label="Year Founded" {...num('year_founded')} />
      </FormRow>

      <FormSection note={locked ? '— underwriting fields locked (deal at/past LOI Signed)' : undefined}>
        Deal Structure
      </FormSection>

      <FormRow>
        <SelectField label="Pipeline Stage" value={form.pipeline_stage} onChange={e => set('pipeline_stage', e.target.value)}>
          {PIPELINE_STAGES.map(s => <option key={s} value={s}>{formatPipelineStage(s)}</option>)}
        </SelectField>
        <SelectField label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </SelectField>
      </FormRow>

      {needsReasoning && (
        <TextareaField
          label="Reasoning *"
          value={reasoning}
          onChange={e => setReasoning(e.target.value)}
          rows={2}
          hint={
            skippedStages.length > 0
              ? `Skips ${skippedStages.map(s => formatPipelineStage(s)).join(', ')}. The reason is recorded against the deal.`
              : undefined
          }
          placeholder={
            statusChangingToTerminal
              ? `Why is this deal moving to ${form.status}?`
              : 'Why is this deal skipping ahead?'
          }
        />
      )}

      <FormRow>
        <TextField label="Security" {...txt('security', { lockable: true })} />
        <TextField label="Use of Proceeds" {...txt('uop')} />
      </FormRow>

      <FormRow>
        <TextField label="Deal Size ($M)" {...num('deal_size_m', true)} />
        <TextField label="Hold Amount ($M)" {...num('hold_amount_m', true)} />
        <TextField label="Tenor (Months)" {...num('tenor_months', true)} />
      </FormRow>

      <FormRow>
        <TextField label="OID (%)" {...num('oid_pct', true)} />
        <TextField label="Spread (bps)" {...num('spread_bps', true)} />
      </FormRow>

      <FormRow>
        <TextField label="SOFR Rate (%)" {...num('sofr_rate', true)} />
        <TextField label="SOFR Floor (%)" {...num('sofr_floor_pct', true)} />
      </FormRow>

      <FormSection>Financials &amp; Covenants (Optional)</FormSection>

      <FormRow>
        <TextField label="LTM Revenue ($M)" {...num('ltm_revenue_m', true)} />
        <TextField label="LTM EBITDA ($M)" {...num('ltm_ebitda_m', true)} />
        <TextField label="EBITDA Margin (%)" {...num('ebitda_margin', true)} />
      </FormRow>

      <FormRow>
        <TextField label="Capex ($M)" {...num('capex_m', true)} />
        <TextField label="Revenue Growth (%)" {...num('revenue_growth_pct', true)} />
      </FormRow>

      <FormRow>
        <TextField label="Max Leverage Covenant" {...num('max_leverage_covenant', true)} />
        <TextField label="Min FCCR Covenant" {...num('min_fccr_covenant', true)} />
        <TextField label="Capex Limit Covenant ($M)" {...num('capex_limit_covenant_m', true)} />
      </FormRow>

      {error && <FormError>{error}</FormError>}

      <FormActions>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Deal'}
        </Button>
      </FormActions>
    </Form>
  )
}
