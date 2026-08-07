import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { approveInboxItem, assignInboxItem, listInbox, rejectInboxItem } from '../api/inbox'

// Cache key kept as 'review-queue' since NavBar's scan handler already
// invalidates that key to refresh the pending-suggestions count.
export function useInbox() {
  return useQuery({ queryKey: ['review-queue'], queryFn: listInbox })
}

export function useApproveInboxItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, value, reviewer, dealId }: { id: number; value?: string; reviewer?: string; dealId?: string }) =>
      approveInboxItem(id, value, reviewer, dealId),
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
    mutationFn: ({ id, dealId, reviewer }: { id: number; dealId: string; reviewer?: string }) =>
      assignInboxItem(id, dealId, reviewer),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review-queue'] })
      qc.invalidateQueries({ queryKey: ['deals'] })
    },
  })
}

export function useRejectInboxItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reviewer }: { id: number; reviewer?: string }) => rejectInboxItem(id, reviewer),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['review-queue'] }),
  })
}
