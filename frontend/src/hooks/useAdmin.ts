import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchDailyCost, fetchScanRuns, fetchSyncState, unparkSyncState } from '../api/admin'

export const SYNC_STATE_KEY = ['admin', 'sync-state'] as const
export const SCAN_RUNS_KEY = ['admin', 'scan-runs'] as const
export const COST_KEY = ['admin', 'cost'] as const

export function useSyncState() {
  return useQuery({ queryKey: SYNC_STATE_KEY, queryFn: fetchSyncState })
}

export function useUnparkSync() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, resync }: { id: string; resync?: boolean }) => unparkSyncState(id, resync),
    onSuccess: () => qc.invalidateQueries({ queryKey: SYNC_STATE_KEY }),
  })
}

export function useDailyCost() {
  return useQuery({ queryKey: COST_KEY, queryFn: fetchDailyCost })
}

export function useScanRuns(poll: boolean) {
  return useQuery({
    queryKey: SCAN_RUNS_KEY,
    queryFn: () => fetchScanRuns(20),
    refetchInterval: (query) => (poll || query.state.data?.some((run) => run.status === 'running') ? 3000 : false),
  })
}
