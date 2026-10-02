import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardHeader, CardTitle } from '@leontechrepo/leon-ui'
import type { UnfiledDocument } from '../../api/inbox'
import { useFileUnfiledDocument, useUnfiledDocuments } from '../../hooks/useInbox'
import { TonedBadge } from '../ui/TonedBadge'
import { Button } from '../ui/Button/Button'
import { DealSearchSelect } from '../ui/DealSearchSelect'
import { apiErrorDetail, formatBytes } from './inboxCopy'
import styles from './Inbox.module.css'

function UnfiledRow({ doc, fromOpenEmail = false }: { doc: UnfiledDocument; fromOpenEmail?: boolean }) {
  const file = useFileUnfiledDocument()
  const [dealId, setDealId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ dealId: string; extraction: boolean; duplicate: boolean } | null>(null)

  async function submit() {
    if (!dealId) return
    setError(null)
    try {
      const r = await file.mutateAsync({ docId: doc.id, dealId })
      setResult({ dealId, extraction: Boolean(r.extraction_run_id), duplicate: !r.filed })
    } catch (err) {
      setError(apiErrorDetail(err))
    }
  }

  return (
    <li className={styles.docRow}>
      <div>
        <div className={styles.attachName}>{doc.name}</div>
        <div className={styles.attachSub}>
          {doc.email_subject ?? 'No source email'}
          {doc.email_from ? ` · ${doc.email_from}` : ''}
          {doc.size_bytes != null ? ` · ${formatBytes(doc.size_bytes)}` : ''}
        </div>
      </div>
      <TonedBadge tone={fromOpenEmail ? 'gold' : 'amber'}>{fromOpenEmail ? 'From the open email' : 'Unfiled'}</TonedBadge>
      <div className={styles.docPick}>
        <DealSearchSelect
          value={dealId}
          onChange={setDealId}
          disabled={file.isPending}
          placeholder="File to deal…"
          ariaLabel={`File ${doc.name} to deal`}
        />
        <Button variant="secondary" size="sm" type="button" disabled={!dealId || file.isPending} onClick={submit}>
          {file.isPending ? 'Filing…' : 'File'}
        </Button>
      </div>
      {error && (
        <div className={`${styles.notice} ${styles.noticeError}`} role="alert" style={{ gridColumn: '1 / -1' }}>
          {error}
        </div>
      )}
      {result && (
        <div className={`${styles.notice} ${styles.noticeOk}`} role="status" style={{ gridColumn: '1 / -1' }}>
          {result.duplicate ? 'Already on that deal — duplicate discarded.' : 'Filed.'}
          {result.extraction && (
            <>
              {' '}Extraction queued — <Link to={`/deals/${result.dealId}?tab=documents`}>open Documents</Link>.
            </>
          )}
        </div>
      )}
    </li>
  )
}

/**
 * Stored attachments that no deal owns yet. This is a standing, workspace-wide
 * list — it is NOT scoped to the open email — so it says so, and when an email
 * is selected it can be narrowed to just that email's files.
 */
export function UnfiledDocuments({ selectedLogId = null }: { selectedLogId?: number | null }) {
  const { data: docs = [], isError } = useUnfiledDocuments()
  const fromSelected = selectedLogId == null ? [] : docs.filter((d) => d.email_scan_log_id === selectedLogId)
  const [scope, setScope] = useState<'all' | 'email'>('all')
  if (isError || docs.length === 0) return null

  // Narrow to the open email only while it actually has unfiled files.
  const narrowed = scope === 'email' && fromSelected.length > 0
  const shown = narrowed ? fromSelected : docs
  const ordered = narrowed
    ? shown
    : [...shown].sort(
        (a, b) =>
          Number(b.email_scan_log_id === selectedLogId) - Number(a.email_scan_log_id === selectedLogId),
      )

  return (
    <Card aria-label="Unfiled documents" style={{ padding: 0 }}>
      <CardHeader>
        <CardTitle>
          Unfiled documents — {narrowed ? 'this email' : 'all emails'} ({shown.length})
        </CardTitle>
      </CardHeader>
      <p className={styles.unfiledNote}>
        Stored email attachments not yet assigned to a deal. This list is workspace-wide and is not tied to the
        email you have open.
      </p>
      {selectedLogId != null && (
        <div className={styles.unfiledScope} role="group" aria-label="Unfiled documents scope">
          <Button
            variant={narrowed ? 'primary' : 'secondary'}
            size="sm"
            type="button"
            disabled={fromSelected.length === 0}
            onClick={() => setScope('email')}
            title={fromSelected.length === 0 ? 'The open email has no unfiled files' : undefined}
          >
            This email ({fromSelected.length})
          </Button>
          <Button variant={narrowed ? 'secondary' : 'primary'} size="sm" type="button" onClick={() => setScope('all')}>
            All emails ({docs.length})
          </Button>
        </div>
      )}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {ordered.map((d) => (
          <UnfiledRow key={d.id} doc={d} fromOpenEmail={d.email_scan_log_id === selectedLogId} />
        ))}
      </ul>
    </Card>
  )
}
