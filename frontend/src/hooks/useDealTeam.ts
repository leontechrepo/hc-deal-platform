import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createTeamMember, deleteTeamMember, listTeamMembers, updateTeamMember } from '../api/dealTeam'
import type { DealTeamMemberInput } from '../types'

export function useDealTeamMembers(dealId: string | null) {
  return useQuery({
    queryKey: ['deals', dealId, 'team-members'],
    queryFn: () => listTeamMembers(dealId as string),
    enabled: dealId !== null,
  })
}

export function useCreateTeamMember(dealId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<DealTeamMemberInput>) => createTeamMember(dealId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', dealId, 'team-members'] }),
  })
}

export function useUpdateTeamMember(dealId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ teamId, body }: { teamId: number; body: Partial<DealTeamMemberInput> }) =>
      updateTeamMember(dealId, teamId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', dealId, 'team-members'] }),
  })
}

export function useDeleteTeamMember(dealId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (teamId: number) => deleteTeamMember(dealId, teamId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', dealId, 'team-members'] }),
  })
}
