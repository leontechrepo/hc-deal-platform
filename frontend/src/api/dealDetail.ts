import type { DealActivity, DealNote } from '../types'
import { apiFetch, apiFetchBlob } from './client'

export function listDealActivity(dealId: number): Promise<DealActivity[]> {
  return apiFetch(`/api/deals/${dealId}/activity`)
}

export function listDealNotes(dealId: number): Promise<DealNote[]> {
  return apiFetch(`/api/deals/${dealId}/notes`)
}

export function createDealNote(dealId: number, body: { author?: string; body: string }): Promise<DealNote> {
  return apiFetch(`/api/deals/${dealId}/notes`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateDealNote(noteId: number, body: string): Promise<DealNote> {
  return apiFetch(`/api/notes/${noteId}`, {
    method: 'PATCH',
    body: JSON.stringify({ body }),
  })
}

export function deleteDealNote(noteId: number): Promise<{ ok: boolean; note_id: number }> {
  return apiFetch(`/api/notes/${noteId}`, { method: 'DELETE' })
}

export function exportDealUnderwriting(dealId: number): Promise<Blob> {
  return apiFetchBlob(`/api/deals/${dealId}/underwriting/export`)
}
