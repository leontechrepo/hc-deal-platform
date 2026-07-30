import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { approveInboxItem, assignInboxItem, listInbox, rejectInboxItem } from '../api/inbox'

export function useInbox() {
  return useQuery({ queryKey: ['inbox'], queryFn: listInbox })
}

export function useApproveInboxItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, value }: { id: number; value?: string }) => approveInboxItem(id, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox'] })
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
      qc.invalidateQueries({ queryKey: ['inbox'] })
      qc.invalidateQueries({ queryKey: ['deals'] })
    },
  })
}

export function useRejectInboxItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => rejectInboxItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox'] }),
  })
}
