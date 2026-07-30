import type { Sponsor, SponsorInput } from '../types'
import { apiFetch } from './client'

export function listSponsors(): Promise<Sponsor[]> {
  return apiFetch('/api/sponsors')
}

export function getSponsor(id: number): Promise<Sponsor> {
  return apiFetch(`/api/sponsors/${id}`)
}

export function createSponsor(body: Partial<SponsorInput>): Promise<Sponsor> {
  return apiFetch('/api/sponsors', { method: 'POST', body: JSON.stringify(body) })
}

export function updateSponsor(id: number, body: Partial<SponsorInput>): Promise<Sponsor> {
  return apiFetch(`/api/sponsors/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteSponsor(id: number): Promise<{ ok: boolean; sponsor_id: number }> {
  return apiFetch(`/api/sponsors/${id}`, { method: 'DELETE' })
}
