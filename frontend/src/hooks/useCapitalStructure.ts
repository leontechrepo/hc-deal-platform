import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createParticipantLender, createTranche, deleteParticipantLender, deleteTranche,
  listParticipantLenders, listTranches, updateParticipantLender, updateTranche,
} from '../api/capitalStructure'
import type { CapitalStructureTrancheInput, ParticipantLenderInput } from '../types'

export function useTranches(dealId: string | null) {
  return useQuery({
    queryKey: ['deals', dealId, 'capital-structure'],
    queryFn: () => listTranches(dealId as string),
    enabled: dealId !== null,
  })
}

export function useCreateTranche(dealId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<CapitalStructureTrancheInput>) => createTranche(dealId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', dealId, 'capital-structure'] }),
  })
}

export function useUpdateTranche(dealId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ trancheId, body }: { trancheId: string; body: Partial<CapitalStructureTrancheInput> }) =>
      updateTranche(dealId, trancheId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', dealId, 'capital-structure'] }),
  })
}

export function useDeleteTranche(dealId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (trancheId: string) => deleteTranche(dealId, trancheId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', dealId, 'capital-structure'] }),
  })
}

export function useParticipantLenders(dealId: string | null) {
  return useQuery({
    queryKey: ['deals', dealId, 'participant-lenders'],
    queryFn: () => listParticipantLenders(dealId as string),
    enabled: dealId !== null,
  })
}

export function useCreateParticipantLender(dealId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<ParticipantLenderInput>) => createParticipantLender(dealId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', dealId, 'participant-lenders'] }),
  })
}

export function useUpdateParticipantLender(dealId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ participantId, body }: { participantId: string; body: Partial<ParticipantLenderInput> }) =>
      updateParticipantLender(dealId, participantId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', dealId, 'participant-lenders'] }),
  })
}

export function useDeleteParticipantLender(dealId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (participantId: string) => deleteParticipantLender(dealId, participantId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', dealId, 'participant-lenders'] }),
  })
}
