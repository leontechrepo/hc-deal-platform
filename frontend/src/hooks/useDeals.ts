import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createDeal, getDeal, listDeals, patchDeal } from '../api/deals'
import type { CreateDealInput } from '../types'

export function useDeals() {
  return useQuery({ queryKey: ['deals'], queryFn: listDeals })
}

export function useDeal(dealId: number | null) {
  return useQuery({
    queryKey: ['deals', dealId],
    queryFn: () => getDeal(dealId as number),
    enabled: dealId !== null,
  })
}

export function usePatchDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ dealId, field, value, actor }: { dealId: number; field: string; value: string | null; actor?: string }) =>
      patchDeal(dealId, field, value, actor),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
    },
  })
}

export function useCreateDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateDealInput) => createDeal(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
    },
  })
}
