import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { DealExtractions } from '../../api/extractions'
import { ApiError } from '../../api/client'
import { cand } from './testFixtures'
import { ExtractionBanners } from './ExtractionBanners'

vi.mock('../../api/extractions', async (orig) => ({
  ...(await orig<typeof import('../../api/extractions')>()),
  fetchDealExtractions: vi.fn(),
  acceptCandidate: vi.fn(),
  rejectCandidate: vi.fn(),
}))

import * as api from '../../api/extractions'
import { ExtractionReviewPanel } from './ReviewPanel'

const mocked = vi.mocked(api)

function renderPanel(data: DealExtractions | Error, deal: object = {}) {
  if (data instanceof Error) mocked.fetchDealExtractions.mockRejectedValue(data)
  else mocked.fetchDealExtractions.mockResolvedValue(data)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ExtractionReviewPanel dealId="d1" deal={deal} documents={[]} />
    </QueryClientProvider>,
  )
}

const payload = (over: Partial<DealExtractions> = {}): DealExtractions => ({
  enabled: true,
  runs: [],
  candidates: [],
  pending_review_count: 0,
  ...over,
})

beforeEach(() => vi.clearAllMocks())

describe('ExtractionReviewPanel', () => {
  it('shows conflicting values with their documents side by side', async () => {
    renderPanel(
      payload({
        candidates: [
          cand({ id: 'a', status: 'conflict', display_value: '$50.0M', document_name: 'CIM.pdf', reason: 'documents disagree on this field' }),
          cand({ id: 'b', status: 'conflict', display_value: '$60.0M', document_id: 2, document_name: 'TermSheet.pdf', reason: 'documents disagree on this field' }),
        ],
      }),
    )
    const group = await screen.findByRole('region', { name: 'Facility size ($M) review' })
    expect(within(group).getByText('$50.0M')).toBeInTheDocument()
    expect(within(group).getByText('$60.0M')).toBeInTheDocument()
    expect(within(group).getByText('CIM.pdf')).toBeInTheDocument()
    expect(within(group).getByText('TermSheet.pdf')).toBeInTheDocument()
    expect(within(group).getAllByRole('button', { name: /^Accept/ })).toHaveLength(2)
    expect(screen.getAllByText('Documents disagree').length).toBeGreaterThan(0)
  })

  it('accepts an empty field without overwrite', async () => {
    mocked.acceptCandidate.mockResolvedValue(cand({ status: 'accepted', needs_review: false }))
    renderPanel(payload({ candidates: [cand({ id: 'x', field: 'dscr', display_value: '1.4x' })] }))
    await userEvent.click(await screen.findByRole('button', { name: /Accept 1.4x/ }))
    await waitFor(() => expect(mocked.acceptCandidate).toHaveBeenCalledWith('x', { overwrite: false }))
  })

  it('requires explicit confirmation before replacing a populated field', async () => {
    mocked.acceptCandidate.mockResolvedValue(cand({ status: 'accepted', needs_review: false }))
    renderPanel(
      payload({ candidates: [cand({ id: 'y', status: 'differs_from_current', reason: 'field already has a value' })] }),
      { deal_size_m: 40 },
    )
    await userEvent.click(await screen.findByRole('button', { name: /^Accept/ }))
    expect(mocked.acceptCandidate).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Replace existing value' }))
    await waitFor(() => expect(mocked.acceptCandidate).toHaveBeenCalledWith('y', { overwrite: true }))
  })

  it('shows inline error text when accept fails with 409 locked', async () => {
    mocked.acceptCandidate.mockRejectedValue(
      new ApiError(409, 'API POST /x → 409: {"detail":"Underwriting fields are locked"}'),
    )
    renderPanel(payload({ candidates: [cand({ id: 'z' })] }))
    await userEvent.click(await screen.findByRole('button', { name: /^Accept/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/locked/)
  })

  it('rejects with an optional note', async () => {
    mocked.rejectCandidate.mockResolvedValue(cand({ status: 'rejected', needs_review: false }))
    renderPanel(payload({ candidates: [cand({ id: 'r' })] }))
    await userEvent.click(await screen.findByRole('button', { name: /^Reject/ }))
    await userEvent.type(screen.getByLabelText(/Note/), 'wrong period')
    await userEvent.click(screen.getByRole('button', { name: 'Confirm reject' }))
    await waitFor(() => expect(mocked.rejectCandidate).toHaveBeenCalledWith('r', { note: 'wrong period' }))
  })

  it('keeps resolved candidates in a Resolved disclosure with reviewer disposition', async () => {
    renderPanel(
      payload({
        candidates: [
          cand({ id: 'h', status: 'rejected', needs_review: false, reviewed_by: 'Ana', review_note: 'stale', reviewed_at: '2026-02-01T12:00:00Z' }),
        ],
      }),
    )
    expect(await screen.findByText('Resolved (1)')).toBeInTheDocument()
    expect(screen.getByText(/Rejected by Ana/)).toHaveTextContent(/stale/)
  })

  it('renders the empty state', async () => {
    renderPanel(payload())
    expect(await screen.findByTestId('no-candidates')).toBeInTheDocument()
  })

  it('renders an error with retry', async () => {
    renderPanel(new Error('boom'))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not load/)
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('shows progress while a run is active', async () => {
    renderPanel(
      payload({
        runs: [
          {
            id: 'r1', deal_id: 'd1', suggestion_id: null, status: 'processing', trigger: 'manual',
            requested_by: 'Ana', document_ids: [1], retry_count: 0, input_tokens: 0, output_tokens: 0,
            estimated_cost_usd: 0, model: null, extracted_fields: null, applied_fields: null,
            applied_field_count: 0, low_confidence_fields: null, conflicts: null, document_errors: null,
            last_error: null, started_at: null, finished_at: null, created_at: '2026-01-01T00:00:00Z',
          },
        ],
      }),
    )
    expect(await screen.findByTestId('extraction-progress')).toHaveTextContent(/in progress/)
  })
})

describe('ExtractionBanners', () => {
  const base = {
    attachment_ingestion_enabled: true,
    document_extraction_enabled: true,
    storage_backend: 's3',
    storage_configured: true,
    graph_folders: [],
  }
  it('is silent when extraction is on and storage is configured', () => {
    render(<ExtractionBanners features={base} />)
    expect(screen.queryByTestId('extraction-banner')).toBeNull()
    expect(screen.queryByTestId('storage-banner')).toBeNull()
  })
  it('says extraction is off', () => {
    render(<ExtractionBanners features={{ ...base, document_extraction_enabled: false }} />)
    expect(screen.getByTestId('extraction-banner')).toHaveTextContent('Extraction is off')
  })
  it('says extraction needs attachment ingestion', () => {
    render(
      <ExtractionBanners
        features={{ ...base, document_extraction_enabled: false, attachment_ingestion_enabled: false, document_extraction_requires_ingestion: true }}
      />,
    )
    expect(screen.getByTestId('extraction-banner')).toHaveTextContent('needs attachment ingestion')
  })
  it('warns when storage is not configured', () => {
    render(<ExtractionBanners features={{ ...base, storage_configured: false }} />)
    expect(screen.getByTestId('storage-banner')).toHaveTextContent(/not configured/)
  })
})
