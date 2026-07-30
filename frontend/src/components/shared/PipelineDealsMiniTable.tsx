import { DataTable, type Column } from '../ui/DataTable/DataTable'
import { PipelineStageBadge } from './PipelineStageBadge'
import { StatusBadge } from './StatusBadge'
import type { FundDealSummary, SponsorDealSummary } from '../../types'

function fmtM(value: number | null): string {
  return value === null ? '—' : `$${value.toFixed(1)}M`
}

function fmtX(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(2)}x`
}

function fmtPct(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(2)}%`
}

type MiniDeal = SponsorDealSummary | FundDealSummary

interface Props {
  deals: MiniDeal[]
  showHoldAmount?: boolean
}

export function PipelineDealsMiniTable({ deals, showHoldAmount = false }: Props) {
  const columns: Column<MiniDeal>[] = [
    { key: 'company_name', header: 'Company', render: d => d.company_name },
    { key: 'pipeline_stage', header: 'Stage', render: d => <PipelineStageBadge stage={d.pipeline_stage} /> },
    {
      key: 'status',
      header: 'Status',
      render: d => <StatusBadge status={d.status} />,
    },
    { key: 'deal_size_m', header: 'Deal Size', render: d => fmtM(d.deal_size_m), mono: true },
    ...(showHoldAmount
      ? [{ key: 'hold_amount_m', header: 'Hold Amount', render: (d: MiniDeal) => fmtM('hold_amount_m' in d ? d.hold_amount_m : null), mono: true } as Column<MiniDeal>]
      : []),
    { key: 'total_leverage', header: 'Leverage', render: d => fmtX(d.total_leverage), mono: true },
    { key: 'all_in_rate', header: 'All-in Rate', render: d => fmtPct(d.all_in_rate), mono: true },
  ]

  return (
    <DataTable
      columns={columns}
      rows={deals}
      rowKey={d => d.id}
      emptyMessage="No deals yet."
    />
  )
}
