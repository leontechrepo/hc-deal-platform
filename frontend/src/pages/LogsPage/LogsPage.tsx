import { useQueryClient } from '@tanstack/react-query'
import { Mail, Play, ScrollText } from 'lucide-react'
import { useState } from 'react'
import { Button, Card, CardHeader, CardTitle, EmptyState, Kpi, KpiGrid } from '@leontechrepo/leon-ui'
import { triggerScan, type ScanRun } from '../../api/admin'
import { PageActions } from '../../components/shell/PageActions'
import { SyncStatusCard } from '../../components/logs/SyncStatusCard'
import { DataTable, type Column } from '../../components/ui/DataTable/DataTable'
import { PageError } from '../../components/ui/PageState'
import { LoadingBlock } from '../../components/ui/Skeleton/Skeleton'
import { TonedBadge } from '../../components/ui/TonedBadge'
import { useToast } from '../../components/Toast/Toast'
import { useDailyCost, useScanRuns, useSyncState, SCAN_RUNS_KEY } from '../../hooks/useAdmin'
import { useDealUpdateLogs, useEmailScanLogs } from '../../hooks/useLogs'
import { useFeatures } from '../../hooks/useFeatures'
import { scanRunTone, type BadgeTone } from '../../domain/badgeTones'
import { formatTimestamp } from '../../domain/format'
import type { DealUpdateLogEntry, EmailScanLogEntry } from '../../types'
import styles from './LogsPage.module.css'

const SOURCE_TONE: Record<string, BadgeTone> = {
  manual_edit: 'blue',
  email_scan: 'navy',
  excel_import: 'green',
}

function SourceBadge({ source }: { source: string }) {
  return <TonedBadge tone={SOURCE_TONE[source] ?? 'muted'}>{source.replace(/_/g, ' ')}</TonedBadge>
}

const dim = <span className={styles.dim}>—</span>

const runColumns: Column<ScanRun>[] = [
  { key: 'started', header: 'Started', render: (r) => (r.started_at ? formatTimestamp(r.started_at) : '—') },
  { key: 'trigger', header: 'Trigger', render: (r) => r.trigger },
  { key: 'status', header: 'Status', render: (r) => <TonedBadge tone={scanRunTone(r.status)}>{r.status}</TonedBadge> },
  { key: 'seen', header: 'Seen', mono: true, render: (r) => r.messages_seen },
  { key: 'classified', header: 'Classified', mono: true, render: (r) => r.messages_classified },
  { key: 'suggestions', header: 'Suggestions', mono: true, render: (r) => r.suggestions_created },
  { key: 'cost', header: 'Cost', mono: true, render: (r) => `$${r.estimated_cost_usd.toFixed(4)}` },
]

const updateColumns: Column<DealUpdateLogEntry>[] = [
  { key: 'ts', header: 'Timestamp', render: (l) => <span className={styles.ts}>{formatTimestamp(l.changed_at)}</span> },
  { key: 'company', header: 'Company', render: (l) => <span className={styles.strong}>{l.company_name}</span> },
  { key: 'field', header: 'Field', mono: true, render: (l) => l.field_changed },
  {
    key: 'change',
    header: 'Change',
    render: (l) => (
      <div className={styles.valueChange}>
        {l.old_value && <span className={styles.oldVal} title={l.old_value}>{l.old_value}</span>}
        {l.old_value && l.new_value && <span className={styles.arrow}>→</span>}
        {l.new_value && <span className={styles.newVal} title={l.new_value}>{l.new_value}</span>}
      </div>
    ),
  },
  { key: 'source', header: 'Source', render: (l) => <SourceBadge source={l.source} /> },
  { key: 'subject', header: 'Email Subject', width: 200, render: (l) => <span className={styles.clip}>{l.email_subject ?? '—'}</span> },
]

const emailColumns: Column<EmailScanLogEntry>[] = [
  { key: 'ts', header: 'Processed', render: (l) => <span className={styles.ts}>{formatTimestamp(l.processed_at)}</span> },
  { key: 'subject', header: 'Subject', width: 220, render: (l) => (l.subject ? <span className={styles.clip}>{l.subject}</span> : dim) },
  { key: 'deal', header: 'Matched Deal', render: (l) => (l.company_name ? <span className={styles.strong}>{l.company_name}</span> : <span className={styles.dim}>No match</span>) },
  { key: 'action', header: 'Action Taken', render: (l) => (l.action_taken ? <SourceBadge source={l.action_taken} /> : dim) },
  { key: 'summary', header: 'Claude Summary', width: 320, render: (l) => <div className={styles.summary}>{l.claude_summary ?? '—'}</div> },
]

function LogCard<T>({
  title,
  isLoading,
  isError,
  rows,
  columns,
  rowKey,
  emptyTitle,
  emptyText,
}: {
  title: string
  isLoading: boolean
  isError: boolean
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string | number
  emptyTitle: string
  emptyText: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      {isLoading ? (
        <LoadingBlock label={`Loading ${title.toLowerCase()}…`} />
      ) : isError ? (
        <PageError title={`Couldn't load ${title.toLowerCase()}`} />
      ) : rows.length === 0 ? (
        <EmptyState icon={ScrollText} title={emptyTitle}>{emptyText}</EmptyState>
      ) : (
        <DataTable columns={columns} rows={rows} rowKey={rowKey} />
      )}
    </Card>
  )
}

function costSummary(by: Record<string, { estimated_cost_usd: number; calls: number } | number>): string {
  const parts = Object.entries(by).map(([purpose, v]) =>
    typeof v === 'number' ? `${purpose} $${v.toFixed(2)}` : `${purpose} $${v.estimated_cost_usd.toFixed(2)}`,
  )
  return parts.length ? parts.join(' · ') : 'No LLM calls in the last 24h'
}

export function LogsPage() {
  const dealLogsQuery = useDealUpdateLogs()
  const emailLogsQuery = useEmailScanLogs()
  const { data: features } = useFeatures()
  const { data: sync } = useSyncState()
  const { data: cost } = useDailyCost()
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const [triggered, setTriggered] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const runsQuery = useScanRuns(triggered)
  const runs = runsQuery.data ?? []

  const graphConfigured = Boolean(features?.graph_folders?.length)
  const running = triggered || runs.some((run) => run.status === 'running')
  const parked = sync?.folders.filter((f) => f.parked).length ?? 0
  const backlog = (sync?.claims.retry ?? 0) + (sync?.claims.error ?? 0)

  /**
   * Do not await the POST in a mutation: the scan is synchronous server-side and
   * can run long. Detach it and poll scan-runs.
   */
  function startScan() {
    if (!graphConfigured) {
      showToast('Mailbox scanning is not configured', true)
      return
    }
    setNotice(null)
    setTriggered(true)
    void queryClient.invalidateQueries({ queryKey: SCAN_RUNS_KEY })

    triggerScan()
      .then((result) => {
        const message =
          result.status === 'skipped_locked'
            ? 'A scan was already running (the scheduler holds the lock), so this click did nothing.'
            : `Scan finished: ${result.status} — ${result.emails_processed} classified.`
        setNotice(message)
        showToast(message, result.status === 'skipped_locked' || result.status === 'error')
        for (const key of [['review-queue'], ['logs'], ['deals'], ['kpis'], ['admin']]) {
          void queryClient.invalidateQueries({ queryKey: key })
        }
      })
      .catch((err: Error) => {
        setNotice(err.message)
        showToast('Scan failed', true)
      })
      .finally(() => {
        setTriggered(false)
        void queryClient.invalidateQueries({ queryKey: SCAN_RUNS_KEY })
      })
  }

  const scanButton = (
    <Button
      size="sm"
      type="button"
      disabled={running || !graphConfigured}
      onClick={startScan}
      title={graphConfigured ? 'Scan monitored mailboxes' : 'Mailbox scanning is not configured'}
    >
      <Play size={14} strokeWidth={2.05} aria-hidden />
      {running ? 'Scanning…' : 'Scan Now'}
    </Button>
  )

  return (
    <>
      <PageActions>{scanButton}</PageActions>

      <KpiGrid>
        <Kpi label="LLM Cost (24h)" value={cost ? `$${cost.estimated_cost_usd.toFixed(2)}` : '—'} sub={cost ? costSummary(cost.by_purpose) : undefined} />
        <Kpi label="Parked Folders" value={sync ? parked : '—'} tone={parked > 0 ? 'red' : undefined} />
        <Kpi label="Retry / Error Backlog" value={sync ? backlog : '—'} tone={backlog > 0 ? 'red' : undefined} />
        <Kpi label="Recent Scan" value={runs[0] ? runs[0].status : '—'} sub={runs[0]?.started_at ? formatTimestamp(runs[0].started_at) : undefined} />
      </KpiGrid>

      <div className="detail-cards">
        <Card>
          <CardHeader>
            <CardTitle>Mailbox scan</CardTitle>
            <Button variant="secondary" size="sm" type="button" disabled={running || !graphConfigured} onClick={startScan}>
              <Mail size={14} strokeWidth={2.05} aria-hidden />
              {running ? 'Scanning…' : 'Scan Now'}
            </Button>
          </CardHeader>
          <p className={styles.scanCopy}>
            Scans monitored mailboxes for messages the classifier has not seen and queues suggestions for review.
            It never writes to a deal directly. A scan also runs on a schedule; both take the same advisory lock so
            they cannot overlap.
          </p>
          {!graphConfigured && (
            <p className={styles.scanDisabled}>Graph mailboxes are not configured — Scan Now is unavailable.</p>
          )}
          {notice && (
            <p className={styles.scanNotice} role="status">
              {notice}
            </p>
          )}
        </Card>

        <SyncStatusCard />

        <LogCard
          title="Recent scan runs"
          isLoading={runsQuery.isLoading}
          isError={runsQuery.isError}
          rows={runs}
          columns={runColumns}
          rowKey={(r) => r.id}
          emptyTitle="No scan has run yet"
          emptyText="Runs appear here once a scan starts."
        />

        <LogCard
          title="Deal Update Log"
          isLoading={dealLogsQuery.isLoading}
          isError={dealLogsQuery.isError}
          rows={dealLogsQuery.data ?? []}
          columns={updateColumns}
          rowKey={(l) => l.id}
          emptyTitle="No updates recorded yet"
          emptyText="Field changes made by users, scans, and imports are logged here."
        />

        <LogCard
          title="Email Scan Log"
          isLoading={emailLogsQuery.isLoading}
          isError={emailLogsQuery.isError}
          rows={emailLogsQuery.data ?? []}
          columns={emailColumns}
          rowKey={(l) => l.id}
          emptyTitle="No emails scanned yet"
          emptyText="Each classified message is recorded here with the action taken."
        />
      </div>
    </>
  )
}
