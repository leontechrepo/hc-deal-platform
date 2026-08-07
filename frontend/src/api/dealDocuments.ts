import type { DealDocument } from '../types'
import { apiFetch, apiFetchBlob, apiFetchForm } from './client'

export function listDealDocuments(dealId: string): Promise<DealDocument[]> {
  return apiFetch(`/api/deals/${dealId}/documents`)
}

export function uploadDealDocument(dealId: string, file: File, category: string): Promise<DealDocument> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('category', category)
  return apiFetchForm(`/api/deals/${dealId}/documents`, formData)
}

export function deleteDealDocument(documentId: number): Promise<{ ok: boolean; document_id: number }> {
  return apiFetch(`/api/documents/${documentId}`, { method: 'DELETE' })
}

export function downloadDealDocument(documentId: number): Promise<Blob> {
  return apiFetchBlob(`/api/documents/${documentId}/download`)
}
