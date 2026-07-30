import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createFund, createLP, deleteFund, deleteLP, listFunds, updateFund, updateLP,
} from '../api/funds'
import type { FundInput, FundLPInput } from '../types'

export function useFunds() {
  return useQuery({ queryKey: ['funds'], queryFn: listFunds })
}

export function useCreateFund() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<FundInput>) => createFund(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funds'] }),
  })
}

export function useUpdateFund() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<FundInput> }) => updateFund(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funds'] }),
  })
}

export function useDeleteFund() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteFund(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funds'] }),
  })
}

export function useCreateLP() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ fundId, body }: { fundId: number; body: FundLPInput }) => createLP(fundId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funds'] }),
  })
}

export function useUpdateLP() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ fundId, lpId, body }: { fundId: number; lpId: number; body: Partial<FundLPInput> }) =>
      updateLP(fundId, lpId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funds'] }),
  })
}

export function useDeleteLP() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ fundId, lpId }: { fundId: number; lpId: number }) => deleteLP(fundId, lpId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['funds'] }),
  })
}
