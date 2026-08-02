import type { PendingSuggestion } from '../types'
import { apiFetch } from './client'

export function getReviewQueue(): Promise<PendingSuggestion[]> {
  return apiFetch('/api/review-queue')
}

export function approveSuggestion(id: number, value?: string, reviewer?: string): Promise<unknown> {
  return apiFetch(`/api/review-queue/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ reviewer: reviewer || 'user', value: value ?? null }),
  })
}

export function rejectSuggestion(id: number, reviewer?: string): Promise<unknown> {
  const qs = reviewer ? `?reviewer=${encodeURIComponent(reviewer)}` : ''
  return apiFetch(`/api/review-queue/${id}/reject${qs}`, { method: 'POST' })
}
