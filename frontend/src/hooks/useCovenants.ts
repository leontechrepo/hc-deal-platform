import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCovenant, listCovenants, updateCovenant } from '../api/covenants'
import type { CovenantInput, CovenantPatchInput } from '../types'

export function useCovenants(dealId: string | null) {
  return useQuery({
    queryKey: ['deals', dealId, 'covenants'],
    queryFn: () => listCovenants(dealId as string),
    enabled: dealId !== null,
  })
}

export function useCreateCovenant(dealId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<CovenantInput>) => createCovenant(dealId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', dealId, 'covenants'] }),
  })
}

export function useUpdateCovenant(dealId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ covenantId, body }: { covenantId: string; body: CovenantPatchInput }) =>
      updateCovenant(dealId, covenantId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', dealId, 'covenants'] }),
  })
}
