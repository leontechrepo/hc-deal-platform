import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { approveSuggestion, getReviewQueue, rejectSuggestion } from '../api/reviewQueue'

export function useReviewQueue() {
  return useQuery({ queryKey: ['review-queue'], queryFn: getReviewQueue })
}

export function useApproveSuggestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, value }: { id: number; value?: string }) => approveSuggestion(id, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review-queue'] })
      qc.invalidateQueries({ queryKey: ['deals'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
    },
  })
}

export function useRejectSuggestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => rejectSuggestion(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review-queue'] })
    },
  })
}
