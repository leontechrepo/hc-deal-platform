import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createDeal, listDeals, patchDeal } from '../api/deals'
import type { CreateDealInput } from '../types'

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
