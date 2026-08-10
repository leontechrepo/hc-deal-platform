import type { Company, CompanyInput } from '../types'
import { apiFetch } from './client'

export function listCompanies(): Promise<Company[]> {
  return apiFetch('/api/companies')
}

export function getCompany(companyId: string): Promise<Company> {
  return apiFetch(`/api/companies/${companyId}`)
}

export function createCompany(body: Partial<CompanyInput>): Promise<Company> {
  return apiFetch('/api/companies', { method: 'POST', body: JSON.stringify(body) })
}

export function updateCompany(companyId: string, body: Partial<CompanyInput>): Promise<Company> {
  return apiFetch(`/api/companies/${companyId}`, { method: 'PATCH', body: JSON.stringify(body) })
}
