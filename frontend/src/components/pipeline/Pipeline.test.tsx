import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@leontechrepo/leon-ui'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PipelinePage } from '../../pages/PipelinePage/PipelinePage'
import { PIPELINE_STAGES, formatPipelineStage } from '../../domain/stages'
import { makeDeal } from '../../test/fixtures'
import { ToastProvider } from '../Toast/Toast'

const mocks = vi.hoisted(() => ({
  useDeals: vi.fn(),
  useKPIs: vi.fn(),
  patch: vi.fn(),
}))

vi.mock('../../hooks/useDeals', () => ({
  useDeals: mocks.useDeals,
  useCreateDeal: () => ({ mutateAsync: vi.fn() }),
  useUpdateDeal: () => ({ mutateAsync: vi.fn() }),
  useDeleteDeal: () => ({ mutateAsync: vi.fn() }),
  usePatchDeal: () => ({ mutate: mocks.patch, isPending: false }),
}))
vi.mock('../../hooks/useKPIs', () => ({ useKPIs: mocks.useKPIs }))
vi.mock('../../hooks/useCurrentActor', () => ({ useCurrentActor: () => 'tester' }))

function renderPipeline(url = '/pipeline?view=kanban') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <MemoryRouter initialEntries={[url]}>
            <PipelinePage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

function stageColumns() {
  return PIPELINE_STAGES.map((stage) => screen.getByRole('region', { name: formatPipelineStage(stage)! }))
}

beforeEach(() => {
  mocks.useKPIs.mockReturnValue({ data: undefined })
  mocks.patch.mockReset()
})

describe('Pipeline board', () => {
  it('renders all 11 stage columns with deals in the right column', () => {
    mocks.useDeals.mockReturnValue({
      data: [
        makeDeal({ id: 'a', company_name: 'Acme Holdings', pipeline_stage: 'screening' }),
        makeDeal({ id: 'b', company_name: 'Beta Corp', pipeline_stage: 'loi_signed', deal_size_m: 40 }),
      ],
      isLoading: false,
      isError: false,
    })
    renderPipeline()

    expect(stageColumns()).toHaveLength(11)
    const screening = screen.getByRole('region', { name: 'Screening' })
    expect(within(screening).getByText('Acme Holdings')).toBeInTheDocument()
    const loiSigned = screen.getByRole('region', { name: 'LOI Signed' })
    expect(within(loiSigned).getByText('Beta Corp')).toBeInTheDocument()
    expect(within(screening).queryByText('Beta Corp')).not.toBeInTheDocument()
  })

  it('still renders all 11 columns, each saying "No deals", when there is no data', () => {
    mocks.useDeals.mockReturnValue({ data: [], isLoading: false, isError: false })
    renderPipeline()

    const columns = stageColumns()
    expect(columns).toHaveLength(11)
    for (const col of columns) expect(within(col).getByText('No deals')).toBeInTheDocument()
  })

  it('shows a loading skeleton instead of columns while loading', () => {
    mocks.useDeals.mockReturnValue({ data: undefined, isLoading: true, isError: false })
    renderPipeline()

    expect(screen.getByRole('status', { name: 'Loading deals' })).toBeInTheDocument()
    expect(screen.queryByTestId('kanban-board')).not.toBeInTheDocument()
  })

  it('shows an error state with retry when the request fails', async () => {
    const refetch = vi.fn()
    mocks.useDeals.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('boom'),
      refetch,
    })
    renderPipeline()

    expect(screen.getByText("Couldn't load the pipeline")).toBeInTheDocument()
    expect(screen.getByText('boom')).toBeInTheDocument()
    expect(screen.queryByTestId('kanban-board')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('shows the empty state in table view when nothing exists', () => {
    mocks.useDeals.mockReturnValue({ data: [], isLoading: false, isError: false })
    renderPipeline('/pipeline?view=table')
    expect(screen.getByText('No deals yet')).toBeInTheDocument()
  })

  it('opens on the board by default, and remembers the chosen view', async () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    })
    mocks.useDeals.mockReturnValue({ data: [makeDeal({ id: 'a' })], isLoading: false, isError: false })
    const first = renderPipeline('/pipeline')
    expect(screen.getByRole('button', { name: 'Board' })).toHaveAttribute('aria-pressed', 'true')
    expect(stageColumns()).toHaveLength(11)
    await userEvent.click(screen.getByRole('button', { name: 'Table' }))
    expect(localStorage.getItem('hc-pipeline-view')).toBe('table')
    first.unmount()

    renderPipeline('/pipeline') // a fresh visit uses the remembered view
    expect(screen.getByRole('button', { name: 'Table' })).toHaveAttribute('aria-pressed', 'true')
    vi.unstubAllGlobals()
  })

  it('filters by search text', async () => {
    mocks.useDeals.mockReturnValue({
      data: [
        makeDeal({ id: 'a', company_name: 'Acme Holdings' }),
        makeDeal({ id: 'b', company_name: 'Beta Corp' }),
      ],
      isLoading: false,
      isError: false,
    })
    renderPipeline()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search deals' }), 'beta')
    expect(screen.queryByText('Acme Holdings')).not.toBeInTheDocument()
    expect(screen.getByText('Beta Corp')).toBeInTheDocument()
  })
})
