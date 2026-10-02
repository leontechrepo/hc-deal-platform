import { apiFetch } from './client'

export interface ScanTriggerResult {
  ok: boolean
  emails_processed: number
  status: string
  run_id: string | null
  messages_seen?: number
  suggestions_created?: number
  estimated_cost_usd?: number
}

export interface ScanRun {
  id: string
  trigger: string
  status: string
  started_at: string | null
  finished_at: string | null
  messages_seen: number
  messages_classified: number
  messages_filtered: number
  messages_deduped: number
  suggestions_created: number
  field_updates_proposed: number
  field_updates_rejected: number
  estimated_cost_usd: number
  input_tokens: number | null
  output_tokens: number | null
  error_counts: Record<string, number> | null
  error_message: string | null
}

export function triggerScan(): Promise<ScanTriggerResult> {
  return apiFetch('/api/admin/scan', { method: 'POST' })
}

export function fetchScanRuns(limit = 20): Promise<ScanRun[]> {
  return apiFetch(`/api/admin/scan-runs?limit=${limit}`)
}

export interface SyncFolderState {
  id: string
  user_email: string
  folder: string
  mode: string
  has_delta_link?: boolean
  mid_sync?: boolean
  last_synced_at: string | null
  last_error: string | null
  consecutive_failures: number
  parked: boolean
  parked_at: string | null
  max_failures?: number
  resync_count: number
}

export interface SyncState {
  folders: SyncFolderState[]
  claims: { processing?: number; retry?: number; error?: number }
}

export interface DailyCost {
  window_hours?: number
  estimated_cost_usd: number
  by_purpose: Record<string, { estimated_cost_usd: number; calls: number } | number>
}

export function fetchSyncState(): Promise<SyncState> {
  return apiFetch('/api/admin/sync-state')
}

/** Clear a parked mailbox folder; `resync` also discards its delta link. */
export function unparkSyncState(id: string, resync = false): Promise<SyncFolderState> {
  const q = resync ? '?resync=true' : ''
  return apiFetch(`/api/admin/sync-state/${encodeURIComponent(id)}/unpark${q}`, { method: 'POST' })
}

export function fetchDailyCost(): Promise<DailyCost> {
  return apiFetch('/api/admin/cost')
}
