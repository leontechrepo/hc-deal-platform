import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createDealNote, deleteDealNote, listDealActivity, listDealNotes, updateDealNote,
} from '../api/dealDetail'
import { deleteDealDocument, listDealDocuments, uploadDealDocument } from '../api/dealDocuments'

export function useDealActivity(dealId: string | null) {
  return useQuery({
    queryKey: ['deals', dealId, 'activity'],
    queryFn: () => listDealActivity(dealId as string),
    enabled: dealId !== null,
  })
}

export function useDealNotes(dealId: string | null) {
  return useQuery({
    queryKey: ['deals', dealId, 'notes'],
    queryFn: () => listDealNotes(dealId as string),
    enabled: dealId !== null,
  })
}

export function useCreateDealNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ dealId, body }: { dealId: string; body: { author?: string; body: string } }) =>
      createDealNote(dealId, body),
    onSuccess: (_data, { dealId }) => qc.invalidateQueries({ queryKey: ['deals', dealId, 'notes'] }),
  })
}

export function useUpdateDealNote(dealId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ noteId, body }: { noteId: number; body: string }) => updateDealNote(noteId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', dealId, 'notes'] }),
  })
}

export function useDeleteDealNote(dealId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (noteId: number) => deleteDealNote(noteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', dealId, 'notes'] }),
  })
}

export function useDealDocuments(dealId: string | null) {
  return useQuery({
    queryKey: ['deals', dealId, 'documents'],
    queryFn: () => listDealDocuments(dealId as string),
    enabled: dealId !== null,
  })
}

export function useUploadDealDocument(dealId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, category }: { file: File; category: string }) =>
      uploadDealDocument(dealId, file, category),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', dealId, 'documents'] }),
  })
}

export function useDeleteDealDocument(dealId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (documentId: number) => deleteDealDocument(documentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', dealId, 'documents'] }),
  })
}
