import { apiFetch } from './client'

export function triggerScan(): Promise<{ ok: boolean; emails_processed: number }> {
  return apiFetch('/api/admin/scan', { method: 'POST' })
}
