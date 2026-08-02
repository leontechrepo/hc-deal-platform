import type { DealTimelineWorkstream } from '../types'

export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

export interface GanttRange {
  start: Date
  end: Date
}

export function computeGanttRange(workstreams: DealTimelineWorkstream[]): GanttRange | null {
  let minDate: Date | null = null
  let maxDate: Date | null = null
  for (const ws of workstreams) {
    for (const t of ws.tasks) {
      if (t.start_date) {
        const d = parseLocalDate(t.start_date)
        if (!minDate || d < minDate) minDate = d
      }
      if (t.end_date) {
        const d = parseLocalDate(t.end_date)
        if (!maxDate || d > maxDate) maxDate = d
      }
    }
  }
  if (!minDate || !maxDate) return null
  return { start: minDate, end: maxDate }
}

export function dateToX(date: Date, rangeStart: Date, pxPerDay: number): number {
  return daysBetween(rangeStart, date) * pxPerDay
}

export function monthBoundaries(range: GanttRange): Date[] {
  const months: Date[] = []
  const cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1)
  while (cursor <= range.end) {
    months.push(new Date(cursor))
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return months
}
