import type { PortfolioMonitoringTest, PortfolioPosition, PortfolioPositionInput, PortfolioTestInput } from '../types'
import { apiFetch } from './client'

export function listPortfolio(): Promise<PortfolioPosition[]> {
  return apiFetch('/api/portfolio')
}

export function getPortfolioPosition(dealId: string): Promise<PortfolioPosition> {
  return apiFetch(`/api/portfolio/${dealId}`)
}

export function updatePortfolioPosition(dealId: string, body: PortfolioPositionInput): Promise<PortfolioPosition> {
  return apiFetch(`/api/portfolio/${dealId}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function listPortfolioTests(dealId: string): Promise<PortfolioMonitoringTest[]> {
  return apiFetch(`/api/portfolio/${dealId}/tests`)
}

export function createPortfolioTest(dealId: string, body: PortfolioTestInput): Promise<PortfolioMonitoringTest> {
  return apiFetch(`/api/portfolio/${dealId}/tests`, { method: 'POST', body: JSON.stringify(body) })
}
