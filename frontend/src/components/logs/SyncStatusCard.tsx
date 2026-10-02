import { AlertTriangle, MailCheck } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, EmptyState } from '@leontechrepo/leon-ui'
import type { SyncFolderState } from '../../api/admin'
import { useSyncState, useUnparkSync } from '../../hooks/useAdmin'
import { useToast } from '../Toast/Toast'
import { DataTable, type Column } from '../ui/DataTable/DataTable'
import { LoadingBlock } from '../ui/Skeleton/Skeleton'
import { TonedBadge } from '../ui/TonedBadge'
import { RowActions } from '../ui/RowActions'
import type { BadgeTone } from '../../domain/badgeTones'
import { formatTimestamp } from '../../domain/format'
import styles from './SyncStatusCard.module.css'

function folderTone(folder: SyncFolderState): BadgeTone {
  if (folder.parked) return 'red'
  if (folder.consecutive_failures > 0 || folder.last_error) return 'amber'
  return 'green'
}

function folderLabel(folder: SyncFolderState): string {
  if (folder.parked) return 'parked'
  if (folder.consecutive_failures > 0) return 'failing'
  return 'healthy'
}

/**
 * Mailbox sync status: one row per mailbox/folder with its delta mode and last
 * error, plus the claim backlog. A parked folder (too many consecutive
 * failures) can be unparked, optionally forcing a full resync.
 */
export function SyncStatusCard() {
  const { data, isLoading, isError, refetch } = useSyncState()
  const unpark = useUnparkSync()
  const { showToast } = useToast()

  async function handleUnpark(folder: SyncFolderState, resync: boolean) {
    try {
      await unpark.mutateAsync({ id: folder.id, resync })
      showToast(`${folder.user_email} / ${folder.folder} unparked${resync ? ' (full resync)' : ''}`)
    } catch {
      showToast('Unpark failed', true)
    }
  }

  const columns: Column<SyncFolderState>[] = [
    {
      key: 'mailbox',
      header: 'Mailbox / Folder',
      render: (f) => (
        <>
          <div className={styles.strong}>{f.user_email}</div>
          <div className={styles.dim}>{f.folder}</div>
        </>
      ),
    },
    { key: 'state', header: 'State', render: (f) => <TonedBadge tone={folderTone(f)}>{folderLabel(f)}</TonedBadge> },
    { key: 'mode', header: 'Mode', render: (f) => f.mode.replace(/_/g, ' ') },
    { key: 'last', header: 'Last Synced', render: (f) => (f.last_synced_at ? formatTimestamp(f.last_synced_at) : '—') },
    { key: 'failures', header: 'Failures', mono: true, render: (f) => f.consecutive_failures },
    { key: 'resyncs', header: 'Resyncs', mono: true, render: (f) => f.resync_count },
    {
      key: 'error',
      header: 'Last Error',
      width: 220,
      render: (f) => (f.last_error ? <span className={styles.error} title={f.last_error}>{f.last_error}</span> : <span className={styles.dim}>—</span>),
    },
    {
      key: 'actions',
      header: '',
      render: (f) =>
        f.parked ? (
          <RowActions>
            <Button size="sm" variant="secondary" disabled={unpark.isPending} onClick={() => void handleUnpark(f, false)}>
              Unpark
            </Button>
            <Button size="sm" variant="ghost" disabled={unpark.isPending} onClick={() => void handleUnpark(f, true)} title="Unpark and discard the delta link, forcing a full resync">
              Unpark + resync
            </Button>
          </RowActions>
        ) : null,
    },
  ]

  const claims = data?.claims ?? {}
  const parkedCount = data?.folders.filter((f) => f.parked).length ?? 0

  return (
    <Card aria-label="Sync status">
      <CardHeader>
        <CardTitle>Sync status</CardTitle>
        {data && (
          <div className={styles.summary}>
            {parkedCount > 0 && <TonedBadge tone="red">{parkedCount} parked</TonedBadge>}
            <TonedBadge tone="muted">processing {claims.processing ?? 0}</TonedBadge>
            <TonedBadge tone={(claims.retry ?? 0) > 0 ? 'amber' : 'muted'}>retry {claims.retry ?? 0}</TonedBadge>
            <TonedBadge tone={(claims.error ?? 0) > 0 ? 'red' : 'muted'}>error {claims.error ?? 0}</TonedBadge>
          </div>
        )}
      </CardHeader>
      {isLoading ? (
        <LoadingBlock label="Loading sync status…" lines={3} />
      ) : isError || !data ? (
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load sync status"
          action={<Button size="sm" variant="secondary" onClick={() => void refetch()}>Try again</Button>}
        >
          The sync-state endpoint did not respond.
        </EmptyState>
      ) : data.folders.length === 0 ? (
        <EmptyState icon={MailCheck} title="No mailbox folders tracked yet">
          Folders appear here after the first scan seeds their delta state.
        </EmptyState>
      ) : (
        <DataTable columns={columns} rows={data.folders} rowKey={(f) => f.id} />
      )}
    </Card>
  )
}
