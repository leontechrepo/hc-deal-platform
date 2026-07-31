import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { approveSuggestion, getReviewQueue, rejectSuggestion } from '../api/reviewQueue'

export function useReviewQueue() {
  return useQuery({ queryKey: ['review-queue'], queryFn: getReviewQueue })
}

export function useApproveSuggestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, value, reviewer }: { id: number; value?: string; reviewer?: string }) =>
      approveSuggestion(id, value, reviewer),
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
    mutationFn: ({ id, reviewer }: { id: number; reviewer?: string }) => rejectSuggestion(id, reviewer),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review-queue'] })
    },
  })
}
