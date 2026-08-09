import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createCompany, getCompany, listCompanies, updateCompany } from '../api/companies'
import type { CompanyInput } from '../types'

export function useCompanies() {
  return useQuery({ queryKey: ['companies'], queryFn: listCompanies })
}

export function useCompany(companyId: string | null) {
  return useQuery({
    queryKey: ['companies', companyId],
    queryFn: () => getCompany(companyId as string),
    enabled: companyId !== null,
  })
}

export function useCreateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<CompanyInput>) => createCompany(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  })
}

export function useUpdateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ companyId, body }: { companyId: string; body: Partial<CompanyInput> }) =>
      updateCompany(companyId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] })
      qc.invalidateQueries({ queryKey: ['deals'] })
    },
  })
}
