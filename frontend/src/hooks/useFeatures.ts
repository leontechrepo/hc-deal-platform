import { useQuery } from '@tanstack/react-query'
import { fetchFeatures } from '../api/meta'

export function useFeatures() {
  return useQuery({
    queryKey: ['meta', 'features'],
    queryFn: fetchFeatures,
    staleTime: Infinity,
  })
}
