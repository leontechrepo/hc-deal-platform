import type { Covenant, CovenantInput, CovenantPatchInput } from '../types'
import { apiFetch } from './client'

export function listCovenants(dealId: string): Promise<Covenant[]> {
  return apiFetch(`/api/deals/${dealId}/covenants`)
}

export function createCovenant(dealId: string, body: Partial<CovenantInput>): Promise<Covenant> {
  return apiFetch(`/api/deals/${dealId}/covenants`, { method: 'POST', body: JSON.stringify(body) })
}

export function updateCovenant(dealId: string, covenantId: string, body: CovenantPatchInput): Promise<Covenant> {
  return apiFetch(`/api/deals/${dealId}/covenants/${covenantId}`, { method: 'PATCH', body: JSON.stringify(body) })
}
