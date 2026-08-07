import { useQuery } from '@tanstack/react-query'
import { getDealUpdateLogs, getEmailScanLogs } from '../api/logs'

export function useDealUpdateLogs(dealId?: string) {
  return useQuery({
    queryKey: ['logs', 'deal-updates', dealId],
    queryFn: () => getDealUpdateLogs({ limit: 100, deal_id: dealId }),
  })
}

export function useEmailScanLogs() {
  return useQuery({
    queryKey: ['logs', 'email-scans'],
    queryFn: () => getEmailScanLogs({ limit: 100 }),
  })
}
