import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createSponsor, deleteSponsor, listSponsors, updateSponsor } from '../api/sponsors'
import type { SponsorInput } from '../types'

export function useSponsors() {
  return useQuery({ queryKey: ['sponsors'], queryFn: listSponsors })
}

export function useCreateSponsor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<SponsorInput>) => createSponsor(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sponsors'] }),
  })
}

export function useUpdateSponsor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<SponsorInput> }) => updateSponsor(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sponsors'] }),
  })
}

export function useDeleteSponsor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteSponsor(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sponsors'] }),
  })
}
