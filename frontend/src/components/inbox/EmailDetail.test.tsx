import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EmailDetail } from './EmailDetail'
import { ATTACHMENTS_DISABLED_COPY } from './inboxCopy'
import { makeGroup, makeSuggestion } from './testFixtures'

let emailBody: Record<string, unknown> = { available: false, reason: 'graph_not_configured', body: null }

beforeEach(() => {
  emailBody = { available: false, reason: 'graph_not_configured', body: null }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      new Response(JSON.stringify(/\/email$/.test(url) ? emailBody : []), { status: 200 }),
    ),
  )
})

function renderDetail(group: ReturnType<typeof makeGroup>, ingestionEnabled: boolean | undefined) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <EmailDetail group={group} ingestionEnabled={ingestionEnabled} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const populated = makeGroup({
  id: 'g1',
  mailbox: 'deals@leon.com',
  email_subject: 'Re: Acme term sheet',
  email_from: 'cfo@acme.com',
  email_from_name: 'Pat CFO',
  email_snippet: 'We can upsize the facility to $75M.',
  received_at: '2026-02-01T15:00:00Z',
  has_attachments: true,
  attachment_count: 3,
  attachment_state: 'failed',
  source_removed: true,
  deal_id: 'deal-1',
  deal_name: 'Acme Holdings',
  attachment_summary: [
    { name: 'model.xlsx', disposition: 'stored', document_id: 7 },
    { name: 'copy.pdf', disposition: 'duplicate', document_id: 8 },
    { name: 'logo.png', disposition: 'skipped', reason: 'message_budget' },
    { name: 'broken.pdf', disposition: 'failed', reason: 'timeout', attempts: 2 },
  ],
  documents: [
    {
      id: 7, name: 'Acme Model v3', doc_type: 'model', size_bytes: 1000, sha256: 'x',
      deal_id: 'deal-1', filed: true, processing_status: 'done', human_review_required: false, skip_reason: null,
    },
    {
      id: 8, name: 'Acme Copy', doc_type: null, size_bytes: 1000, sha256: 'y',
      deal_id: null, filed: false, processing_status: null, human_review_required: false, skip_reason: null,
    },
  ],
  suggestions: [
    makeSuggestion({
      id: 1,
      evidence: '"we would like to upsize to $75M"',
      current_value: '50',
      suggested_value: '75',
      requires_attention: true,
    }),
  ],
})

describe('EmailDetail', () => {
  it('renders the email, collapsed attachments, and one collapsed review row', async () => {
    renderDetail(populated, true)

    expect(screen.getByRole('heading', { name: 'Re: Acme term sheet' })).toBeInTheDocument()
    expect(screen.getByText(/source email was deleted/i)).toBeInTheDocument()
    expect(screen.getByText('We can upsize the facility to $75M.')).toBeInTheDocument()

    const attachments = screen.getByRole('region', { name: 'Attachments' })
    // Collapsed by default, but the things that need a person stay visible.
    expect(within(attachments).getByText('1 failed')).toBeInTheDocument()
    expect(within(attachments).getByText('1 to file')).toBeInTheDocument()
    expect(within(attachments).queryByText('model.xlsx')).not.toBeInTheDocument()
    await userEvent.click(within(attachments).getByRole('button', { name: /Attachments \(3\)/ }))
    // Only what needs a person is a badge: the failed fetch and the unfiled stored file.
    expect(within(attachments).getByText('Failed')).toBeInTheDocument()
    expect(within(attachments).getByText('Needs filing')).toBeInTheDocument()
    expect(within(attachments).getByText(/after 2 attempts — timeout/)).toBeInTheDocument()
    // Informational outcomes are plain text, not badges.
    expect(within(attachments).queryByText('Stored')).not.toBeInTheDocument()
    expect(within(attachments).queryByText('Duplicate')).not.toBeInTheDocument()
    expect(within(attachments).queryByText('Skipped')).not.toBeInTheDocument()
    expect(within(attachments).getByText(/per-email attachment limit/)).toBeInTheDocument()
    expect(within(attachments).getByText(/Filed to a deal/)).toBeInTheDocument()
    expect(within(attachments).getByText(/Stored, not yet filed to a deal/)).toBeInTheDocument()

    const form = screen.getByRole('region', { name: 'Review' })
    expect(within(form).queryByLabelText('Facility size ($M)')).not.toBeInTheDocument()
    await userEvent.click(within(form).getByRole('button', { name: /Review & Update Deal/ }))
    expect(within(form).getByText('Acme Holdings')).toBeInTheDocument()
    expect(within(form).getByLabelText('Facility size ($M)')).toHaveValue('75')
    expect(within(form).getByText(/now: 50.00M/)).toBeInTheDocument()
    expect(within(form).getByText(/we would like to upsize to \$75M/)).toBeInTheDocument()
    expect(within(form).getByText('Large move')).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Apply 1 change' })).toBeEnabled()
    expect(within(form).getByRole('button', { name: 'Dismiss' })).toBeEnabled()
  })

  it('states plainly that ingestion is disabled', async () => {
    const g = makeGroup({
      id: 'g2',
      has_attachments: true,
      attachment_count: 1,
      attachment_state: 'disabled',
      suggestions: [makeSuggestion({ id: 2 })],
    })
    renderDetail(g, false)
    expect(screen.getByText(ATTACHMENTS_DISABLED_COPY)).toBeInTheDocument()
  })

  it('shows the full email body when it can be read', async () => {
    emailBody = { available: true, reason: null, body: 'Hi team,\n\nWe will upsize to $75M and extend tenor.', truncated: false }
    renderDetail(populated, true)
    const box = await screen.findByLabelText('Email body')
    expect(box).toHaveTextContent('We will upsize to $75M and extend tenor.')
    expect(screen.queryByText(/Loading the full email/)).not.toBeInTheDocument()
  })

  it('falls back to the stored preview and says why the body is missing', async () => {
    renderDetail(populated, true)
    expect(screen.getByText('We can upsize the facility to $75M.')).toBeInTheDocument()
    expect(await screen.findByText(/Mailbox access is not configured/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Email body')).not.toBeInTheDocument()
  })
})
