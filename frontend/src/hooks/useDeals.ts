import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listDeals, patchDeal } from '../api/deals'

export function useDeals() {
  return useQuery({ queryKey: ['deals'], queryFn: listDeals })
}

export function usePatchDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ dealId, field, value }: { dealId: number; field: string; value: string | null }) =>
      patchDeal(dealId, field, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
    },
  })
}
