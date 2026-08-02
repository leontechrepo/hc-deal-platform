import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createDealNote, deleteDealNote, listDealActivity, listDealNotes, updateDealNote,
} from '../api/dealDetail'

export function useDealActivity(dealId: number | null) {
  return useQuery({
    queryKey: ['deals', dealId, 'activity'],
    queryFn: () => listDealActivity(dealId as number),
    enabled: dealId !== null,
  })
}

export function useDealNotes(dealId: number | null) {
  return useQuery({
    queryKey: ['deals', dealId, 'notes'],
    queryFn: () => listDealNotes(dealId as number),
    enabled: dealId !== null,
  })
}

export function useCreateDealNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ dealId, body }: { dealId: number; body: { author?: string; body: string } }) =>
      createDealNote(dealId, body),
    onSuccess: (_data, { dealId }) => qc.invalidateQueries({ queryKey: ['deals', dealId, 'notes'] }),
  })
}

export function useUpdateDealNote(dealId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ noteId, body }: { noteId: number; body: string }) => updateDealNote(noteId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', dealId, 'notes'] }),
  })
}

export function useDeleteDealNote(dealId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (noteId: number) => deleteDealNote(noteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', dealId, 'notes'] }),
  })
}
