import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createDeal, deleteDeal, getDeal, listDeals, patchDeal, updateDeal } from '../api/deals'
import type { CreateDealInput } from '../types'

export function useDeals() {
  return useQuery({ queryKey: ['deals'], queryFn: listDeals })
}

export function useDeal(dealId: string | null) {
  return useQuery({
    queryKey: ['deals', dealId],
    queryFn: () => getDeal(dealId as string),
    enabled: dealId !== null,
  })
}

export function usePatchDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ dealId, field, value, actor, reasoning }: { dealId: string; field: string; value: string | null; actor?: string; reasoning?: string }) =>
      patchDeal(dealId, field, value, actor, reasoning),
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

export function useUpdateDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ dealId, body }: { dealId: string; body: Partial<CreateDealInput> & { reasoning?: string } }) => updateDeal(dealId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
    },
  })
}

export function useDeleteDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dealId: string) => deleteDeal(dealId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] })
      qc.invalidateQueries({ queryKey: ['kpis'] })
    },
  })
}
