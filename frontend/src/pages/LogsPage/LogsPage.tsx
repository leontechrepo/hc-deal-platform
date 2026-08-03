import { PageShell } from '../../components/ui/PageShell/PageShell'
import { useDealUpdateLogs, useEmailScanLogs } from '../../hooks/useLogs'
import styles from './LogsPage.module.css'

function formatTs(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function SourceBadge({ source }: { source: string }) {
  const cls = [styles.source, styles[source as keyof typeof styles]].filter(Boolean).join(' ')
  return <span className={cls}>{source.replace('_', ' ')}</span>
}

export function LogsPage() {
  const { data: dealLogs = [], isLoading: loadingDeal } = useDealUpdateLogs()
  const { data: emailLogs = [], isLoading: loadingEmail } = useEmailScanLogs()

  return (
    <PageShell title="Activity Logs" sub="Deal updates · Email scan history">
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Deal Update Log</div>
        {loadingDeal ? (
          <div className={styles.loading}>Loading…</div>
        ) : dealLogs.length === 0 ? (
          <div className={styles.empty}>No updates recorded yet.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Company</th>
                <th>Field</th>
                <th>Change</th>
                <th>Source</th>
                <th>Email Subject</th>
              </tr>
            </thead>
            <tbody>
              {dealLogs.map(log => (
                <tr key={log.id}>
                  <td className={styles.ts}>{formatTs(log.changed_at)}</td>
                  <td style={{ fontWeight: 500 }}>{log.company_name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{log.field_changed}</td>
                  <td>
                    <div className={styles.valueChange}>
                      {log.old_value && <span className={styles.oldVal} title={log.old_value}>{log.old_value}</span>}
                      {log.old_value && log.new_value && <span className={styles.arrow}>→</span>}
                      {log.new_value && <span className={styles.newVal} title={log.new_value}>{log.new_value}</span>}
                    </div>
                  </td>
                  <td><SourceBadge source={log.source} /></td>
                  <td className={styles.ts} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.email_subject ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Email Scan Log</div>
        {loadingEmail ? (
          <div className={styles.loading}>Loading…</div>
        ) : emailLogs.length === 0 ? (
          <div className={styles.empty}>No emails scanned yet.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Processed</th>
                <th>Subject</th>
                <th>Matched Deal</th>
                <th>Action Taken</th>
                <th>Claude Summary</th>
              </tr>
            </thead>
            <tbody>
              {emailLogs.map(log => (
                <tr key={log.id}>
                  <td className={styles.ts}>{formatTs(log.processed_at)}</td>
                  <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.subject ?? <span style={{ color: 'var(--gray-400)' }}>—</span>}
                  </td>
                  <td style={{ fontWeight: 500 }}>
                    {log.company_name ?? <span style={{ color: 'var(--gray-400)' }}>No match</span>}
                  </td>
                  <td>
                    {log.action_taken ? (
                      <SourceBadge source={log.action_taken} />
                    ) : (
                      <span style={{ color: 'var(--gray-400)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <div className={styles.summary}>{log.claude_summary ?? '—'}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageShell>
  )
}
