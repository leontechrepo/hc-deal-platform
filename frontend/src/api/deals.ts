import type { CreateDealInput, Deal } from '../types'
import { apiFetch } from './client'

export function listDeals(): Promise<Deal[]> {
  return apiFetch('/api/deals')
}

export function patchDeal(dealId: number, field: string, value: string | null): Promise<unknown> {
  return apiFetch(`/api/deals/${dealId}`, {
    method: 'PATCH',
    body: JSON.stringify({ field, value }),
  })
}

export function createDeal(body: CreateDealInput): Promise<{ ok: boolean; deal_id: number; company_name: string }> {
  return apiFetch('/api/deals', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
