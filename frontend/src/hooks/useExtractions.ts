import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  acceptCandidate,
  fetchDealExtractions,
  rejectCandidate,
  startDealExtraction,
  type DealExtractions,
} from '../api/extractions'

export const extractionsKey = (dealId: string) => ['deals', dealId, 'extractions'] as const

export const POLL_MS = 4000

export function hasActiveRun(data: DealExtractions | undefined): boolean {
  return Boolean(data?.runs.some((r) => r.status === 'pending' || r.status === 'processing'))
}

/** Everything the review surface needs; polls ~4s while any run is in flight. */
export function useDealExtractions(dealId: string) {
  return useQuery({
    queryKey: extractionsKey(dealId),
    queryFn: () => fetchDealExtractions(dealId),
    refetchInterval: (q) => (hasActiveRun(q.state.data) ? POLL_MS : false),
  })
}

function useInvalidateDeal(dealId: string) {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: extractionsKey(dealId) }),
      qc.invalidateQueries({ queryKey: ['deals', dealId, 'documents'] }),
      // accepting a candidate changes deal fields
      qc.invalidateQueries({ queryKey: ['deals', dealId], exact: true }),
      qc.invalidateQueries({ queryKey: ['deals'], exact: true }),
    ])
}

export function useStartExtraction(dealId: string) {
  const invalidate = useInvalidateDeal(dealId)
  return useMutation({
    mutationFn: (documentIds: number[]) => startDealExtraction(dealId, documentIds),
    onSuccess: invalidate,
  })
}

export function useAcceptCandidate(dealId: string) {
  const invalidate = useInvalidateDeal(dealId)
  return useMutation({
    mutationFn: ({ id, overwrite, note }: { id: string; overwrite?: boolean; note?: string }) =>
      acceptCandidate(id, { overwrite: overwrite ?? false, ...(note ? { note } : {}) }),
    onSuccess: invalidate,
    // a 409 "already resolved" means the data is stale; refresh either way
    onError: invalidate,
  })
}

export function useRejectCandidate(dealId: string) {
  const invalidate = useInvalidateDeal(dealId)
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      rejectCandidate(id, note ? { note } : {}),
    onSuccess: invalidate,
    onError: invalidate,
  })
}
