// Mirrors app/api/deals.py's create_deal derivation exactly, so the frontend
// never shows a number the backend wouldn't have computed itself.

export function computeAllInRate(sofrRate: number | null, spreadBps: number | null): number | null {
  if (sofrRate === null || spreadBps === null) return null
  return Math.round((sofrRate + spreadBps / 100) * 10000) / 10000
}

export function computeTotalLeverage(dealSizeM: number | null, ltmEbitdaM: number | null): number | null {
  if (dealSizeM === null || !ltmEbitdaM) return null
  return Math.round((dealSizeM / ltmEbitdaM) * 100) / 100
}
