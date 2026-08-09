import type { DealTeamMember, DealTeamMemberInput } from '../types'
import { apiFetch } from './client'

export function listTeamMembers(dealId: string): Promise<DealTeamMember[]> {
  return apiFetch(`/api/deals/${dealId}/team-members`)
}

export function createTeamMember(dealId: string, body: Partial<DealTeamMemberInput>): Promise<DealTeamMember> {
  return apiFetch(`/api/deals/${dealId}/team-members`, { method: 'POST', body: JSON.stringify(body) })
}

export function updateTeamMember(
  dealId: string, teamId: number, body: Partial<DealTeamMemberInput>
): Promise<DealTeamMember> {
  return apiFetch(`/api/deals/${dealId}/team-members/${teamId}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteTeamMember(dealId: string, teamId: number): Promise<{ ok: boolean; team_id: number }> {
  return apiFetch(`/api/deals/${dealId}/team-members/${teamId}`, { method: 'DELETE' })
}
