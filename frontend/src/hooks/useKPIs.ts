import { useQuery } from '@tanstack/react-query'
import { fetchKPIs } from '../api/kpis'

export function useKPIs() {
  return useQuery({ queryKey: ['kpis'], queryFn: fetchKPIs })
}
