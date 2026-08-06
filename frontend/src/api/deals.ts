import type { CreateDealInput, Deal } from '../types'
import { apiFetch } from './client'

export function listDeals(): Promise<Deal[]> {
  return apiFetch('/api/deals')
}

export function getDeal(dealId: string): Promise<Deal> {
  return apiFetch(`/api/deals/${dealId}`)
}

export function patchDeal(dealId: string, field: string, value: string | null, actor?: string): Promise<unknown> {
  return apiFetch(`/api/deals/${dealId}`, {
    method: 'PATCH',
    body: JSON.stringify({ field, value, actor }),
  })
}

export function createDeal(body: CreateDealInput): Promise<{ ok: boolean; deal_id: string; company_name: string }> {
  return apiFetch('/api/deals', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateDeal(
  dealId: string,
  body: Partial<CreateDealInput>
): Promise<{ ok: boolean; deal_id: string; updated_fields: string[]; deal: Deal }> {
  return apiFetch(`/api/deals/${dealId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export function deleteDeal(dealId: string): Promise<{ ok: boolean; deal_id: string; company_name: string }> {
  return apiFetch(`/api/deals/${dealId}`, { method: 'DELETE' })
}
