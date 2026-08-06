import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createPortfolioTest, listPortfolio, listPortfolioTests, updatePortfolioPosition,
} from '../api/portfolio'
import type { PortfolioPositionInput, PortfolioTestInput } from '../types'

export function usePortfolio() {
  return useQuery({ queryKey: ['portfolio'], queryFn: listPortfolio })
}

export function useUpdatePortfolioPosition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ dealId, body }: { dealId: string; body: PortfolioPositionInput }) =>
      updatePortfolioPosition(dealId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portfolio'] }),
  })
}

export function usePortfolioTests(dealId: string | null) {
  return useQuery({
    queryKey: ['portfolio', dealId, 'tests'],
    queryFn: () => listPortfolioTests(dealId as string),
    enabled: dealId !== null,
  })
}

export function useCreatePortfolioTest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ dealId, body }: { dealId: string; body: PortfolioTestInput }) =>
      createPortfolioTest(dealId, body),
    onSuccess: (_data, { dealId }) => {
      qc.invalidateQueries({ queryKey: ['portfolio', dealId, 'tests'] })
      qc.invalidateQueries({ queryKey: ['portfolio'] })
    },
  })
}
