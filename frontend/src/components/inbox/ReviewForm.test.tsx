import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { InboxGroup } from '../../api/inbox'
import { ReviewForm } from './ReviewForm'
import { makeGroup, makeSuggestion } from './testFixtures'

interface Call {
  url: string
  body: Record<string, unknown> & { fields?: unknown; new_deal?: unknown; deal_id?: unknown }
}
const calls: Call[] = []
let invalidated: { mock: { calls: unknown[][] } }
let respond: (url: string) => Response

beforeEach(() => {
  calls.length = 0
  respond = () =>
    new Response(
      JSON.stringify({
        ok: true, deal_id: 'deal-1', company_name: 'Acme', created: false, linked: false,
        applied: [1, 2], rejected: [], remaining: 0,
      }),
      { status: 200 },
    )
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        calls.push({ url, body: init.body ? JSON.parse(String(init.body)) : null })
        return respond(url)
      }
      return new Response(JSON.stringify([]), { status: 200 })
    }),
  )
})

async function renderForm(
  group: InboxGroup,
  handlers: { onApplied?: () => void; onDismissed?: (n: number) => void } = {},
  opts: { collapsed?: boolean } = {},
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  invalidated = vi.spyOn(qc, 'invalidateQueries')
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ReviewForm group={group} {...handlers} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  if (!opts.collapsed) await userEvent.click(screen.getByRole('button', { name: /Review & (Update|Create) Deal/ }))
}

const updates = makeGroup({
  id: '12',
  deal_id: 'deal-1',
  deal_name: 'Acme Holdings',
  suggestions: [
    makeSuggestion({ id: 1, evidence: '"upsize to $75M"', confidence: 0.92 }),
    makeSuggestion({ id: 2, suggested_field: 'spread_bps', suggested_value: '450', current_value: '400', confidence: 0.6, evidence: 'maybe 450' }),
    makeSuggestion({ id: 3, kind: 'commentary', suggested_field: 'commentary', suggested_value: 'Sponsor is upsizing.', current_value: null, confidence: 0.9 }),
  ],
})

describe('ReviewForm – updates to an existing deal', () => {
  it('shows one confidence badge, flags only the weak field, and keeps evidence on its field', async () => {
    await renderForm(updates)
    // One badge for the whole update, at the lowest band.
    expect(screen.getAllByLabelText(/^Confidence:/)).toHaveLength(1)
    expect(screen.getByLabelText(/^Confidence:/)).toHaveAccessibleName(/Weak/)
    // Per-field: only the 60% field carries the flag.
    expect(within(screen.getByTestId('field-spread_bps')).getByText('Weak')).toBeInTheDocument()
    expect(within(screen.getByTestId('field-deal_size_m')).queryByText('Weak')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('field-deal_size_m')).getByText(/upsize to \$75M/)).toBeInTheDocument()
    // A single apply / dismiss pair, no per-field approve or reject.
    expect(screen.getAllByRole('button', { name: /apply|dismiss/i })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument()
  })

  it('applies every edited value in one request', async () => {
    const onApplied = vi.fn()
    await renderForm(updates, { onApplied })
    const size = screen.getByLabelText('Facility size ($M)')
    await userEvent.clear(size)
    await userEvent.type(size, '72.5')
    await userEvent.click(screen.getByLabelText('Apply Spread (bps over SOFR)')) // untick
    await userEvent.click(screen.getByRole('button', { name: 'Apply 2 changes' }))

    await waitFor(() => expect(onApplied).toHaveBeenCalled())
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('/api/inbox/groups/12/accept')
    expect(calls[0].body.deal_id).toBe('deal-1')
    // Filing the email's attachments must refresh the unfiled-documents panel too.
    expect(invalidated.mock.calls).toContainEqual([{ queryKey: ['unfiled-documents'] }])
    expect(calls[0].body.fields).toEqual([
      { suggestion_id: 1, value: '72.5', include: true },
      { suggestion_id: 2, value: '450', include: false },
      { suggestion_id: 3, value: 'Sponsor is upsizing.', include: true },
    ])
  })

  it('marks the failing field and applies nothing when the server returns a 422', async () => {
    respond = () =>
      new Response(
        JSON.stringify({
          detail: {
            message: 'Some values could not be applied',
            errors: [{ suggestion_id: 2, field: 'spread_bps', status: 409, message: 'Underwriting fields are locked' }],
          },
        }),
        { status: 422 },
      )
    const onApplied = vi.fn()
    await renderForm(updates, { onApplied })
    await userEvent.click(screen.getByRole('button', { name: 'Apply 3 changes' }))

    const row = await screen.findByTestId('field-spread_bps')
    expect(await within(row).findByText('Underwriting fields are locked')).toBeInTheDocument()
    expect(screen.getByText(/Nothing was applied/)).toBeInTheDocument()
    expect(screen.getByText(/Untick the locked change/)).toBeInTheDocument()
    expect(onApplied).not.toHaveBeenCalled()
  })

  it('asks for a reason when the server requires one for a stage skip', async () => {
    respond = () =>
      new Response(
        JSON.stringify({
          detail: {
            message: 'x',
            errors: [{ suggestion_id: 1, field: 'pipeline_stage', status: 400, message: "Cannot skip pipeline stages from 'screening' to 'ic_approval'" }],
          },
        }),
        { status: 422 },
      )
    await renderForm(makeGroup({
      id: '4', deal_id: 'deal-1',
      suggestions: [makeSuggestion({ id: 1, suggested_field: 'pipeline_stage', suggested_value: 'ic_approval', current_value: 'screening' })],
    }))
    await userEvent.click(screen.getByRole('button', { name: 'Apply 1 change' }))
    const reason = await screen.findByLabelText('Why is this stage jump correct?')
    expect(screen.getByRole('button', { name: 'Apply 1 change' })).toBeDisabled()

    respond = () => new Response(JSON.stringify({ ok: true, applied: [1], rejected: [], remaining: 0, deal_id: 'deal-1', company_name: 'Acme' }), { status: 200 })
    await userEvent.type(reason, 'IC met early')
    await userEvent.click(screen.getByRole('button', { name: 'Apply 1 change' }))
    await waitFor(() => expect(calls).toHaveLength(2))
    expect(calls[1].body.allow_stage_skip).toBe(true)
    expect(calls[1].body.reasoning).toBe('IC met early')
  })

  it('needs a deal before it can apply, and says so', async () => {
    await renderForm(makeGroup({ id: '5', deal_id: null, suggestions: [makeSuggestion({ id: 1, deal_id: null })] }))
    expect(screen.getByText('Pick the deal these changes belong to.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply 1 change' })).toBeDisabled()
  })

  it('dismisses the whole email after a confirmation', async () => {
    const onDismissed = vi.fn()
    await renderForm(updates, { onDismissed })
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(calls).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: 'Confirm dismiss' }))
    await waitFor(() => expect(onDismissed).toHaveBeenCalledWith(3))
    expect(calls[0].url).toBe('/api/inbox/groups/12/dismiss')
  })
})

describe('ReviewForm – collapsed summary', () => {
  it('shows what it is, the confidence and the flag without rendering any fields', async () => {
    await renderForm(updates, {}, { collapsed: true })
    const row = screen.getByRole('button', { name: /Proposed update/ })
    expect(row).toHaveAttribute('aria-expanded', 'false')
    expect(within(row).getByText(/3 changes · Acme Holdings/)).toBeInTheDocument()
    expect(within(row).getByLabelText(/^Confidence: Weak/)).toBeInTheDocument()
    expect(within(row).getByText('1 flagged')).toBeInTheDocument()
    expect(within(row).getByText('Review & Update Deal')).toBeInTheDocument()
    expect(screen.queryByLabelText('Facility size ($M)')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Apply/ })).not.toBeInTheDocument()
  })

  it('summarises a new deal and offers Review & Create Deal', async () => {
    await renderForm(
      makeGroup({
        id: '30',
        suggestions: [makeSuggestion({ id: 9, kind: 'new_deal', suggested_field: 'new_deal', deal_id: null, company_name: 'Zenith Eye Care', confidence: 0.9, payload: { company_name: 'Zenith Eye Care' } })],
      }),
      {},
      { collapsed: true },
    )
    const row = screen.getByRole('button', { name: /New deal detected/ })
    expect(within(row).getByText('Zenith Eye Care')).toBeInTheDocument()
    expect(within(row).getByLabelText(/^Confidence: Stated/)).toBeInTheDocument()
    expect(within(row).queryByText(/flagged/)).not.toBeInTheDocument()
    expect(within(row).getByText('Review & Create Deal')).toBeInTheDocument()
  })

  it('keeps edits when collapsed and reopened', async () => {
    await renderForm(updates)
    const size = screen.getByLabelText('Facility size ($M)', { exact: true })
    await userEvent.clear(size)
    await userEvent.type(size, '80')
    await userEvent.click(screen.getByRole('button', { name: /Collapse/ }))
    expect(screen.queryByLabelText('Facility size ($M)')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Review & Update Deal/ }))
    expect(screen.getByLabelText('Facility size ($M)', { exact: true })).toHaveValue('80')
  })
})

describe('ReviewForm – new deal', () => {
  const group = makeGroup({
    id: '20',
    suggestions: [
      makeSuggestion({
        id: 9, kind: 'new_deal', suggested_field: 'new_deal', deal_id: null, company_name: 'Acme Dentl',
        confidence: 0.9, estimated_size_m: 40, claude_summary: 'Sponsor intro',
        payload: { company_name: 'Acme Dentl', sector: 'Dental', summary: 'Sponsor intro' },
      }),
    ],
  })

  it('pre-fills an editable form and creates the deal with the corrected values', async () => {
    await renderForm(group)
    const name = screen.getByLabelText('Company name')
    expect(name).toHaveValue('Acme Dentl')
    expect(screen.getByLabelText('Sector')).toHaveValue('Dental')
    expect(screen.getByLabelText('Facility size ($M)')).toHaveValue('40')
    expect(screen.getAllByLabelText(/^Confidence:/)).toHaveLength(1)

    await userEvent.clear(name)
    await userEvent.type(name, 'Acme Dental Partners')
    await userEvent.click(screen.getByRole('button', { name: 'Create deal' }))

    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].body.new_deal).toEqual({
      company_name: 'Acme Dental Partners',
      sector: 'Dental',
      deal_size_m: '40',
      summary: 'Sponsor intro',
    })
    expect(calls[0].body.deal_id).toBeNull()
  })

  it('will not create a deal without a company name', async () => {
    await renderForm(group)
    await userEvent.clear(screen.getByLabelText('Company name'))
    expect(screen.getByRole('button', { name: 'Create deal' })).toBeDisabled()
    expect(screen.getByText('Enter the company name.')).toBeInTheDocument()
  })

  it('switches to linking an existing deal', async () => {
    await renderForm(group)
    await userEvent.click(screen.getByRole('button', { name: 'Link to an existing deal instead' }))
    expect(screen.queryByLabelText('Company name')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Link to deal' })).toBeDisabled()
    expect(screen.getByText('Pick the deal to link this email to.')).toBeInTheDocument()
  })
})
