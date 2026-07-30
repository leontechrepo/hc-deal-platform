import type { PendingSuggestion } from '../types'
import { apiFetch } from './client'

export function listInbox(): Promise<PendingSuggestion[]> {
  return apiFetch('/api/inbox')
}

export function approveInboxItem(id: number, value?: string): Promise<{ ok: boolean; deal_id: number; company_name: string; created?: boolean }> {
  return apiFetch(`/api/inbox/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ reviewer: 'user', value: value ?? null }),
  })
}

export function assignInboxItem(id: number, dealId: number): Promise<{ ok: boolean; deal_id: number; company_name: string }> {
  return apiFetch(`/api/inbox/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify({ deal_id: dealId, reviewer: 'user' }),
  })
}

export function rejectInboxItem(id: number): Promise<{ ok: boolean; suggestion_id: number }> {
  return apiFetch(`/api/inbox/${id}/reject`, { method: 'POST' })
}
