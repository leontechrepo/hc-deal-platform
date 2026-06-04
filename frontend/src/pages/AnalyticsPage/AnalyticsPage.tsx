import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useAnalytics } from '../../hooks/useAnalytics'
import styles from './AnalyticsPage.module.css'

function truncate(str: string, max = 22) {
  return str.length > max ? str.slice(0, max) + '…' : str
}

export function AnalyticsPage() {
  const { data, isLoading, isError } = useAnalytics()

  if (isLoading) return <div className={styles.state}>Loading analytics…</div>
  if (isError || !data) return <div className={styles.state}>Failed to load analytics.</div>

  const funnelData = [
    { stage: 'Total Reviewed', count: data.funnel.total_reviewed },
    { stage: 'NDA Signed', count: data.funnel.nda_signed },
    { stage: 'Closed', count: data.funnel.closed },
  ]

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.eyebrow}>LHP Private Credit — Deal Platform</div>
        <h1 className={styles.title}>Pipeline Analytics</h1>
      </header>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Deal Funnel</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={funnelData} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--gray-200)" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--gray-700)' }} />
              <YAxis type="category" dataKey="stage" width={110} tick={{ fontSize: 11, fill: 'var(--navy)' }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="count" fill="var(--navy)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Reasons for Passing</h2>
          {data.pass_reasons.length === 0 ? (
            <p className={styles.empty}>No pass reasons recorded yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data.pass_reasons}
                layout="vertical"
                margin={{ left: 8, right: 24, top: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--gray-200)" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--gray-700)' }} />
                <YAxis
                  type="category"
                  dataKey="reason"
                  width={140}
                  tick={{ fontSize: 11, fill: 'var(--navy)' }}
                  tickFormatter={(v) => truncate(v, 20)}
                />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" fill="var(--gold)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Sources of Deals</h2>
          {data.deal_sources.length === 0 ? (
            <p className={styles.empty}>No source data recorded yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data.deal_sources}
                layout="vertical"
                margin={{ left: 8, right: 24, top: 8, bottom: 8 }}
              >
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
          <h2 className={styles.cardTitle}>Deals by Quarter</h2>
          {data.deals_by_quarter.length === 0 ? (
            <p className={styles.empty}>No quarterly data recorded yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.deals_by_quarter} margin={{ left: 8, right: 8, top: 8, bottom: 32 }}>
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
