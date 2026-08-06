import type { PendingSuggestion } from '../types'
import { apiFetch } from './client'

export function listInbox(): Promise<PendingSuggestion[]> {
  return apiFetch('/api/inbox')
}

export function approveInboxItem(
  id: number,
  value?: string,
  reviewer?: string,
  dealId?: string,
): Promise<{ ok: boolean; deal_id: string; company_name: string; created?: boolean }> {
  return apiFetch(`/api/inbox/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ reviewer: reviewer || 'user', value: value ?? null, deal_id: dealId ?? null }),
  })
}

export function assignInboxItem(id: number, dealId: string, reviewer?: string): Promise<{ ok: boolean; deal_id: string; company_name: string }> {
  return apiFetch(`/api/inbox/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify({ deal_id: dealId, reviewer: reviewer || 'user' }),
  })
}

export function rejectInboxItem(id: number, reviewer?: string): Promise<{ ok: boolean; suggestion_id: number }> {
  const qs = reviewer ? `?reviewer=${encodeURIComponent(reviewer)}` : ''
  return apiFetch(`/api/inbox/${id}/reject${qs}`, { method: 'POST' })
}
