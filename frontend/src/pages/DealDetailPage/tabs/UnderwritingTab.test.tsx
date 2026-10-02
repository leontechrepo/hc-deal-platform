import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@leontechrepo/leon-ui'
import { describe, expect, it, vi } from 'vitest'
import type { Deal } from '../../../types'
import { makeDeal } from '../../../test/fixtures'
import { ToastProvider } from '../../../components/Toast/Toast'
import { DealProvider } from '../dealContext'
import { UnderwritingTab } from './UnderwritingTab'

vi.mock('../../../hooks/useCurrentActor', () => ({ useCurrentActor: () => 'tester' }))

function renderTab(deal: Deal) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <DealProvider deal={deal}>
            <UnderwritingTab />
          </DealProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

describe('UnderwritingTab lock', () => {
  it('is editable before loi_signed', () => {
    renderTab(makeDeal({ pipeline_stage: 'loi_negotiation', deal_size_m: 25 }))
    expect(screen.queryByText(/underwriting fields are locked/i)).not.toBeInTheDocument()
    expect(screen.getAllByTitle('Click to edit').length).toBeGreaterThan(0)
  })

  it('is read-only at loi_signed even if the backend flag is stale', () => {
    renderTab(makeDeal({ pipeline_stage: 'loi_signed', underwriting_locked: false, deal_size_m: 25 }))
    expect(screen.getByText(/underwriting fields are locked/i)).toBeInTheDocument()
    expect(screen.getByText(/LOI Signed or later/)).toBeInTheDocument()
    expect(screen.queryAllByTitle('Click to edit')).toHaveLength(0)
    // The values are still shown, just not editable.
    expect(screen.getByText('25')).toBeInTheDocument()
  })

  it('is read-only after loi_signed', () => {
    renderTab(makeDeal({ pipeline_stage: 'ic_approval', underwriting_locked: true }))
    expect(screen.getByText(/underwriting fields are locked/i)).toBeInTheDocument()
    expect(screen.queryAllByTitle('Click to edit')).toHaveLength(0)
  })
})
