import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { approveInboxItem, assignInboxItem, listInbox, rejectInboxItem } from '../api/inbox'

// Shares the 'review-queue' cache key with useReviewQueue.ts — /api/inbox and
// /api/review-queue are aliases for the same pending_suggestions data, so both
// hooks (and NavBar's scan handler) must invalidate the same key to stay in sync.
export function useInbox() {
  return useQuery({ queryKey: ['review-queue'], queryFn: listInbox })
}

export function useApproveInboxItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, value }: { id: number; value?: string }) => approveInboxItem(id, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review-queue'] })
      qc.invalidateQueries({ queryKey: ['deals'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
      qc.invalidateQueries({ queryKey: ['portfolio'] })
    },
  })
}

export function useAssignInboxItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, dealId }: { id: number; dealId: number }) => assignInboxItem(id, dealId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review-queue'] })
      qc.invalidateQueries({ queryKey: ['deals'] })
    },
  })
}

export function useRejectInboxItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => rejectInboxItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['review-queue'] }),
  })
}
