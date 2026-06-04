import type { PendingSuggestion } from '../types'
import { apiFetch } from './client'

export function getReviewQueue(): Promise<PendingSuggestion[]> {
  return apiFetch('/api/review-queue')
}

export function approveSuggestion(id: number, value?: string): Promise<unknown> {
  return apiFetch(`/api/review-queue/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ reviewer: 'user', value: value ?? null }),
  })
}

export function rejectSuggestion(id: number): Promise<unknown> {
  return apiFetch(`/api/review-queue/${id}/reject`, { method: 'POST' })
}
