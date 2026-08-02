import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useDeals } from '../../hooks/useDeals'
import type { Deal } from '../../types'
import styles from './AnalyticsPage.module.css'

function truncate(str: string, max = 22) {
  return str.length > max ? str.slice(0, max) + '…' : str
}

function groupCount(arr: string[]): Array<{ key: string; count: number }> {
  const map = new Map<string, number>()
  for (const v of arr) map.set(v, (map.get(v) ?? 0) + 1)
  return Array.from(map.entries()).map(([key, count]) => ({ key, count }))
}

function sortQuarters(a: string, b: string) {
  const [yA, yB] = [a.slice(3), b.slice(3)]
  return yA !== yB ? yA.localeCompare(yB) : a[0].localeCompare(b[0])
}

function filterBySector(deals: Deal[], sector: string) {
  return sector ? deals.filter(d => d.sector_primary === sector) : deals
}

function SectorFilter({ value, onChange, sectors }: {
  value: string
  onChange: (v: string) => void
  sectors: string[]
}) {
  return (
    <select
      className={styles.filterSelect}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">All Sectors</option>
      {sectors.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  )
}

export function AnalyticsPage() {
  const { data: deals = [], isLoading, isError } = useDeals()

  const [funnelSector, setFunnelSector]   = useState('')
  const [passSector, setPassSector]       = useState('')
  const [sourceSector, setSourceSector]   = useState('')
  const [quarterSector, setQuarterSector] = useState('')

  const sectors = useMemo(
    () => [...new Set(deals.map(d => d.sector_primary).filter(Boolean) as string[])].sort(),
    [deals]
  )

  const funnelData = useMemo(() => {
    const fd = filterBySector(deals, funnelSector)
    return [
      { stage: 'Total Reviewed', count: fd.length },
      { stage: 'NDA Signed',     count: fd.filter(d => d.nda === 'P').length },
      { stage: 'Closed',         count: fd.filter(d => d.bucket === 'Closed').length },
    ]
  }, [deals, funnelSector])

  const passReasonsData = useMemo(() => {
    const pd = filterBySector(deals, passSector)
      .filter(d => d.bucket === 'Dead-Hold' && d.reasons_for_passing)
      .map(d => d.reasons_for_passing as string)
    return groupCount(pd)
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
      .map(r => ({ reason: r.key, count: r.count }))
  }, [deals, passSector])

  const dealSourcesData = useMemo(() => {
    const sd = filterBySector(deals, sourceSector)
      .filter(d => d.source)
      .map(d => d.source as string)
    return groupCount(sd)
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
      .map(r => ({ source: r.key, count: r.count }))
  }, [deals, sourceSector])

  const dealsByQuarterData = useMemo(() => {
    const qd = filterBySector(deals, quarterSector)
      .filter(d => d.timing_qtr)
      .map(d => d.timing_qtr as string)
    return groupCount(qd)
      .sort((a, b) => sortQuarters(a.key, b.key))
      .map(r => ({ quarter: r.key, count: r.count }))
  }, [deals, quarterSector])

  if (isLoading) return <div className={styles.state}>Loading analytics…</div>
  if (isError) return <div className={styles.state}>Failed to load analytics.</div>

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.eyebrow}>LHP Private Credit — Deal Platform</div>
        <h1 className={styles.title}>Pipeline Analytics</h1>
      </header>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Deal Funnel</h2>
            <SectorFilter value={funnelSector} onChange={setFunnelSector} sectors={sectors} />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={funnelData} layout="vertical" margin={{ left: 8, right: 24, top: 20, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--gray-200)" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--gray-700)' }} />
              <YAxis type="category" dataKey="stage" width={110} tick={{ fontSize: 11, fill: 'var(--navy)' }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="count" fill="var(--navy)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Reasons for Passing</h2>
            <SectorFilter value={passSector} onChange={setPassSector} sectors={sectors} />
          </div>
          {passReasonsData.length === 0 ? (
            <p className={styles.empty}>No pass reasons recorded yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={passReasonsData} layout="vertical" margin={{ left: 8, right: 24, top: 20, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--gray-200)" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--gray-700)' }} />
                <YAxis
                  type="category"
                  dataKey="reason"
                  width={190}
                  tick={{ fontSize: 11, fill: 'var(--navy)' }}
                  tickFormatter={(v) => truncate(v, 28)}
                />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" fill="var(--gold)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Sources of Deals</h2>
            <SectorFilter value={sourceSector} onChange={setSourceSector} sectors={sectors} />
          </div>
          {dealSourcesData.length === 0 ? (
            <p className={styles.empty}>No source data recorded yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dealSourcesData} layout="vertical" margin={{ left: 8, right: 24, top: 20, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--gray-200)" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--gray-700)' }} />
                <YAxis
                  type="category"
                  dataKey="source"
                  width={160}
                  tick={{ fontSize: 11, fill: 'var(--navy)' }}
                  tickFormatter={(v) => truncate(v, 22)}
                />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" fill="var(--blue-fg)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Deals by Quarter</h2>
            <SectorFilter value={quarterSector} onChange={setQuarterSector} sectors={sectors} />
          </div>
          {dealsByQuarterData.length === 0 ? (
            <p className={styles.empty}>No quarterly data recorded yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dealsByQuarterData} margin={{ left: 8, right: 8, top: 8, bottom: 32 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--gray-200)" />
                <XAxis
                  dataKey="quarter"
                  tick={{ fontSize: 11, fill: 'var(--navy)' }}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--gray-700)' }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" fill="var(--navy-light)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
