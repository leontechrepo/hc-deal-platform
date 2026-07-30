import type { Fund, FundInput, FundLP, FundLPInput } from '../types'
import { apiFetch } from './client'

export function listFunds(): Promise<Fund[]> {
  return apiFetch('/api/funds')
}

export function getFund(id: number): Promise<Fund> {
  return apiFetch(`/api/funds/${id}`)
}

export function createFund(body: Partial<FundInput>): Promise<Fund> {
  return apiFetch('/api/funds', { method: 'POST', body: JSON.stringify(body) })
}

export function updateFund(id: number, body: Partial<FundInput>): Promise<Fund> {
  return apiFetch(`/api/funds/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteFund(id: number): Promise<{ ok: boolean; fund_id: number }> {
  return apiFetch(`/api/funds/${id}`, { method: 'DELETE' })
}

export function createLP(fundId: number, body: FundLPInput): Promise<FundLP> {
  return apiFetch(`/api/funds/${fundId}/lps`, { method: 'POST', body: JSON.stringify(body) })
}

export function updateLP(fundId: number, lpId: number, body: Partial<FundLPInput>): Promise<FundLP> {
  return apiFetch(`/api/funds/${fundId}/lps/${lpId}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteLP(fundId: number, lpId: number): Promise<{ ok: boolean; lp_id: number }> {
  return apiFetch(`/api/funds/${fundId}/lps/${lpId}`, { method: 'DELETE' })
}
