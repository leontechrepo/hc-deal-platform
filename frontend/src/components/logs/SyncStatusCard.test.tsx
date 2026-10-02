import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@leontechrepo/leon-ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SyncState } from '../../api/admin'
import { ToastProvider } from '../Toast/Toast'
import { SyncStatusCard } from './SyncStatusCard'

const api = vi.hoisted(() => ({
  fetchSyncState: vi.fn(),
  unparkSyncState: vi.fn(),
}))

vi.mock('../../api/admin', () => ({
  fetchSyncState: api.fetchSyncState,
  unparkSyncState: api.unparkSyncState,
  fetchDailyCost: vi.fn(),
  fetchScanRuns: vi.fn(),
}))

const healthy = {
  id: 'f-ok',
  user_email: 'ok@leon.com',
  folder: 'Inbox',
  mode: 'delta',
  last_synced_at: '2026-02-01T15:00:00Z',
  last_error: null,
  consecutive_failures: 0,
  parked: false,
  parked_at: null,
  resync_count: 0,
}
const parked = {
  id: 'f-parked',
  user_email: 'stuck@leon.com',
  folder: 'Deals',
  mode: 'needs_seed',
  last_synced_at: null,
  last_error: 'Graph 410 Gone',
  consecutive_failures: 5,
  parked: true,
  parked_at: '2026-02-01T10:00:00Z',
  resync_count: 2,
}

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <SyncStatusCard />
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  api.fetchSyncState.mockReset()
  api.unparkSyncState.mockReset()
  api.unparkSyncState.mockResolvedValue({ ...parked, parked: false })
})

describe('SyncStatusCard', () => {
  it('shows a parked folder with an Unpark button that calls the endpoint', async () => {
    const state: SyncState = { folders: [healthy, parked], claims: { processing: 1, retry: 2, error: 0 } }
    api.fetchSyncState.mockResolvedValue(state)
    renderCard()

    const parkedRow = (await screen.findByText('stuck@leon.com')).closest('tr')!
    expect(within(parkedRow).getByText('parked')).toBeInTheDocument()
    expect(within(parkedRow).getByText('Graph 410 Gone')).toBeInTheDocument()

    // Healthy folders offer no unpark action.
    const okRow = screen.getByText('ok@leon.com').closest('tr')!
    expect(within(okRow).queryByRole('button', { name: 'Unpark' })).not.toBeInTheDocument()

    expect(screen.getByText('retry 2')).toBeInTheDocument()

    await userEvent.click(within(parkedRow).getByRole('button', { name: 'Unpark' }))
    await waitFor(() => expect(api.unparkSyncState).toHaveBeenCalledWith('f-parked', false))
  })

  it('offers unpark with a forced resync', async () => {
    api.fetchSyncState.mockResolvedValue({ folders: [parked], claims: {} })
    renderCard()
    await userEvent.click(await screen.findByRole('button', { name: 'Unpark + resync' }))
    await waitFor(() => expect(api.unparkSyncState).toHaveBeenCalledWith('f-parked', true))
  })

  it('shows an empty state with no folders', async () => {
    api.fetchSyncState.mockResolvedValue({ folders: [], claims: {} })
    renderCard()
    expect(await screen.findByText('No mailbox folders tracked yet')).toBeInTheDocument()
  })

  it('shows an error state when the endpoint fails', async () => {
    api.fetchSyncState.mockRejectedValue(new Error('nope'))
    renderCard()
    expect(await screen.findByText("Couldn't load sync status")).toBeInTheDocument()
  })
})
