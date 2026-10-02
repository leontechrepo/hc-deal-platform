import type { DealDocument } from '../types'
import { apiFetch, apiFetchBlob, apiFetchForm } from './client'

export interface DocumentSourceEmail {
  id: number
  subject: string | null
  sender: string | null
  sender_name: string | null
  received_at: string | null
  source_removed: boolean
}

export type ProcessingStatus = 'pending' | 'extracted' | 'needs_review' | 'skipped' | 'failed'

/** DealDocument plus the provenance / review fields the API now returns. */
export interface DealDocumentRow extends Omit<DealDocument, 'processing_status'> {
  processing_status: ProcessingStatus | string | null
  filed?: boolean
  skip_reason?: string | null
  graph_attachment_id?: string | null
  source_email?: DocumentSourceEmail | null
  pending_review_count?: number
  sha256?: string | null
  storage_backend?: string | null
}

export type UploadDocumentResult = DealDocumentRow & { duplicate?: boolean }

export function listDealDocuments(dealId: string): Promise<DealDocumentRow[]> {
  return apiFetch(`/api/deals/${dealId}/documents`)
}

export function uploadDealDocument(dealId: string, file: File, category: string): Promise<UploadDocumentResult> {
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

export function patchDealDocument(
  documentId: number,
  body: {
    name?: string
    category?: string
    processing_status?: string
    human_review_required?: boolean
  },
): Promise<DealDocumentRow> {
  return apiFetch(`/api/documents/${documentId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}
