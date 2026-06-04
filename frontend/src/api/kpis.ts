import type { KPIs } from '../types'
import { apiFetch } from './client'

export function fetchKPIs(): Promise<KPIs> {
  return apiFetch('/api/kpis')
}
