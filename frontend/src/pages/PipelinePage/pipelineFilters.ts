import type { Deal } from '../../types'

export interface PipelineFilters {
  status: string
  query: string
  sector: string | null
}

export function matchesQuery(deal: Deal, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [deal.company_name, deal.sector_primary, deal.subsector, deal.location, deal.security, deal.contact_name, deal.source]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(q))
}

export function filterDeals(deals: Deal[], { status, query, sector }: PipelineFilters): Deal[] {
  return deals.filter(
    (d) =>
      (status === 'All' || d.status === status) &&
      (sector === null || d.sector_primary === sector) &&
      matchesQuery(d, query),
  )
}

export function distinctSectors(deals: Deal[]): string[] {
  return [...new Set(deals.map((d) => d.sector_primary).filter((s): s is string => !!s))].sort((a, b) => a.localeCompare(b))
}
