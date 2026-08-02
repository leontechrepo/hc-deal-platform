import type { CreateDealInput, Deal } from '../types'
import { apiFetch } from './client'

export function listDeals(): Promise<Deal[]> {
  return apiFetch('/api/deals')
}

export function getDeal(dealId: number): Promise<Deal> {
  return apiFetch(`/api/deals/${dealId}`)
}

export function patchDeal(dealId: number, field: string, value: string | null, actor?: string): Promise<unknown> {
  return apiFetch(`/api/deals/${dealId}`, {
    method: 'PATCH',
    body: JSON.stringify({ field, value, actor }),
  })
}

export function createDeal(body: CreateDealInput): Promise<{ ok: boolean; deal_id: number; company_name: string }> {
  return apiFetch('/api/deals', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
