import type { CapitalStructureTranche, CapitalStructureTrancheInput, ParticipantLender, ParticipantLenderInput } from '../types'
import { apiFetch } from './client'

export function listTranches(dealId: string): Promise<CapitalStructureTranche[]> {
  return apiFetch(`/api/deals/${dealId}/capital-structure`)
}

export function createTranche(dealId: string, body: Partial<CapitalStructureTrancheInput>): Promise<CapitalStructureTranche> {
  return apiFetch(`/api/deals/${dealId}/capital-structure`, { method: 'POST', body: JSON.stringify(body) })
}

export function updateTranche(
  dealId: string, trancheId: string, body: Partial<CapitalStructureTrancheInput>
): Promise<CapitalStructureTranche> {
  return apiFetch(`/api/deals/${dealId}/capital-structure/${trancheId}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteTranche(dealId: string, trancheId: string): Promise<{ ok: boolean; tranche_id: string }> {
  return apiFetch(`/api/deals/${dealId}/capital-structure/${trancheId}`, { method: 'DELETE' })
}

export function listParticipantLenders(dealId: string): Promise<ParticipantLender[]> {
  return apiFetch(`/api/deals/${dealId}/participant-lenders`)
}

export function createParticipantLender(
  dealId: string, body: Partial<ParticipantLenderInput>
): Promise<ParticipantLender> {
  return apiFetch(`/api/deals/${dealId}/participant-lenders`, { method: 'POST', body: JSON.stringify(body) })
}

export function updateParticipantLender(
  dealId: string, participantId: string, body: Partial<ParticipantLenderInput>
): Promise<ParticipantLender> {
  return apiFetch(`/api/deals/${dealId}/participant-lenders/${participantId}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteParticipantLender(dealId: string, participantId: string): Promise<{ ok: boolean; participant_id: string }> {
  return apiFetch(`/api/deals/${dealId}/participant-lenders/${participantId}`, { method: 'DELETE' })
}
