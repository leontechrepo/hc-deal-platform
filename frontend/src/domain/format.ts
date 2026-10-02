/** `$12.50M`, or an em dash when absent. */
export function fmtM(value: number | null | undefined, digits = 2): string {
  return value === null || value === undefined ? '—' : `$${value.toFixed(digits)}M`
}

/** `3.25x`, or an em dash when absent. */
export function fmtX(value: number | null | undefined, digits = 2): string {
  return value === null || value === undefined ? '—' : `${value.toFixed(digits)}x`
}

/** `7.25%`, or an em dash when absent. */
export function fmtPct(value: number | null | undefined, digits = 2): string {
  return value === null || value === undefined ? '—' : `${value.toFixed(digits)}%`
}

/** Sum of `deal_size_m` across deals (nulls ignored). */
export function sumDealSize(deals: ReadonlyArray<{ deal_size_m: number | null }>): number {
  return deals.reduce((acc, d) => acc + (d.deal_size_m ?? 0), 0)
}

/** Parse a `YYYY-MM-DD` string as a local date (avoids the UTC off-by-one). */
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** `Jan 5, 2026, 3:04 PM` */
export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Parse a numeric input; blank or NaN becomes null. */
export function toNullableNumber(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}
