import type { PortfolioMonitoringTest, PortfolioPosition, PortfolioPositionInput, PortfolioTestInput } from '../types'
import { apiFetch } from './client'

export function listPortfolio(): Promise<PortfolioPosition[]> {
  return apiFetch('/api/portfolio')
}

export function getPortfolioPosition(dealId: number): Promise<PortfolioPosition> {
  return apiFetch(`/api/portfolio/${dealId}`)
}

export function updatePortfolioPosition(dealId: number, body: PortfolioPositionInput): Promise<PortfolioPosition> {
  return apiFetch(`/api/portfolio/${dealId}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function listPortfolioTests(dealId: number): Promise<PortfolioMonitoringTest[]> {
  return apiFetch(`/api/portfolio/${dealId}/tests`)
}

export function createPortfolioTest(dealId: number, body: PortfolioTestInput): Promise<PortfolioMonitoringTest> {
  return apiFetch(`/api/portfolio/${dealId}/tests`, { method: 'POST', body: JSON.stringify(body) })
}
