import type { DealUpdateLogEntry, EmailScanLogEntry } from '../types'
import { apiFetch } from './client'

export function getDealUpdateLogs(params?: { limit?: number; offset?: number; deal_id?: number }): Promise<DealUpdateLogEntry[]> {
  const q = new URLSearchParams()
  if (params?.limit) q.set('limit', String(params.limit))
  if (params?.offset) q.set('offset', String(params.offset))
  if (params?.deal_id) q.set('deal_id', String(params.deal_id))
  return apiFetch(`/api/logs/deal-updates?${q}`)
}

export function getEmailScanLogs(params?: { limit?: number; offset?: number }): Promise<EmailScanLogEntry[]> {
  const q = new URLSearchParams()
  if (params?.limit) q.set('limit', String(params.limit))
  if (params?.offset) q.set('offset', String(params.offset))
  return apiFetch(`/api/logs/email-scans?${q}`)
}
