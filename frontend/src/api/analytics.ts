import { apiFetch } from './client'

export interface AnalyticsData {
  funnel: {
    total_reviewed: number
    nda_signed: number
    closed: number
  }
  pass_reasons: Array<{ reason: string; count: number }>
  deal_sources: Array<{ source: string; count: number }>
  deals_by_quarter: Array<{ quarter: string; count: number }>
}

export function fetchAnalytics(): Promise<AnalyticsData> {
  return apiFetch<AnalyticsData>('/api/analytics')
}
