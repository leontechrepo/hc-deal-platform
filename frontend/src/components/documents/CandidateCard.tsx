import { formatFieldValue } from '../inbox/inboxCopy'
import { useState } from 'react'
import type { ExtractionCandidate } from '../../api/extractions'
import { TonedBadge } from '../ui/TonedBadge'
import { Button } from '../ui/Button/Button'
import { useAcceptCandidate, useRejectCandidate } from '../../hooks/useExtractions'
import {
  candidateValue,
  confidenceBand,
  fieldLabel,
  fmtDateTime,
  formatValue,
  isBlank,
  needsReview,
  pct,
  reasonCopy,
  reviewErrorCopy,
  STATUS_LABELS,
  statusTone,
} from './extractionModel'
import styles from './Review.module.css'

interface Props {
  candidate: ExtractionCandidate
  dealId: string
  /** Live value on the deal; falls back to the snapshot stored with the candidate. */
  currentValue?: unknown
  onViewDocument?: (documentId: number) => void
}

export function ConfidenceChip({ confidence }: { confidence: number }) {
  const band = confidenceBand(confidence)
  return (
    <span
      className={`${styles.conf} ${styles[`conf_${band}`]}`}
      aria-label={`Confidence ${pct(confidence)} (${band})`}
      title={`Confidence ${pct(confidence)} (${band}). High is 85% or more, low is under 50%.`}
    >
      <span className={styles.confBar} aria-hidden="true">
        <span style={{ width: pct(Math.max(0, Math.min(1, confidence))) }} />
      </span>
      <span aria-hidden="true">{pct(confidence)}</span>
      <span className={styles.srOnly}>{band}</span>
    </span>
  )
}

/** Current deal value in the same display style as the extracted value ("18.90M", "475 bps"). */
function formatCurrent(field: string, value: unknown): string {
  const text = formatValue(value)
  return value == null || text === '' || text === '—' ? text : formatFieldValue(field, text) || text
}

export function CandidateCard({ candidate: c, dealId, currentValue, onViewDocument }: Props) {
  const accept = useAcceptCandidate(dealId)
  const reject = useRejectCandidate(dealId)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const open = needsReview(c)
  const current = currentValue !== undefined ? currentValue : c.current_value
  const populated = !isBlank(current)
  const busy = accept.isPending || reject.isPending
  const label = fieldLabel(c.field)

  function runAccept(overwrite: boolean) {
    setError(null)
    accept.mutate(
      { id: c.id, overwrite },
      {
        onSuccess: () => setConfirmReplace(false),
        onError: (err) => {
          const copy = reviewErrorCopy(err)
          setError(copy.message)
          if (copy.needsOverwrite) setConfirmReplace(true)
        },
      },
    )
  }

  function onAcceptClick() {
    if (populated) {
      setError(null)
      setRejecting(false)
      setConfirmReplace(true)
      return
    }
    runAccept(false)
  }

  function runReject() {
    setError(null)
    reject.mutate(
      { id: c.id, note: note.trim() || undefined },
      {
        onSuccess: () => setRejecting(false),
        onError: (err) => setError(reviewErrorCopy(err).message),
      },
    )
  }

  return (
    <article
      className={`${styles.card} ${c.status === 'conflict' ? styles.cardConflict : ''}`}
      aria-label={`${label}: ${candidateValue(c)} from ${c.document_name ?? 'unknown document'}`}
    >
      <header className={styles.cardHead}>
        <TonedBadge tone={statusTone(c.status)}>{STATUS_LABELS[c.status] ?? c.status}</TonedBadge>
        <ConfidenceChip confidence={c.confidence} />
      </header>

      <dl className={styles.values}>
        <div>
          <dt>Current</dt>
          <dd data-testid="current-value">{formatCurrent(c.field, current)}</dd>
        </div>
        <div>
          <dt>Extracted</dt>
          <dd className={styles.extracted} data-testid="extracted-value">
            {candidateValue(c)}
          </dd>
        </div>
      </dl>

      {c.evidence && (
        <blockquote className={styles.evidence} cite={c.document_name ?? undefined}>
          {c.evidence}
        </blockquote>
      )}

      <p className={styles.source}>
        Source:{' '}
        {c.document_id != null ? (
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => onViewDocument?.(c.document_id as number)}
            aria-label={`Show document ${c.document_name ?? c.document_id} in the table`}
          >
            {c.document_name ?? `Document #${c.document_id}`}
          </button>
        ) : (
          <span>{c.document_name ?? 'Unknown document'}</span>
        )}
      </p>

      <p className={styles.reason}>{reasonCopy(c)}</p>

      {!open && c.reviewed_by && (
        <p className={styles.disposition}>
          {c.status === 'rejected' ? 'Rejected' : 'Accepted'} by {c.reviewed_by}
          {c.reviewed_at ? ` on ${fmtDateTime(c.reviewed_at)}` : ''}
          {c.review_note ? ` — "${c.review_note}"` : ''}
        </p>
      )}

      {open && (
        <div className={styles.actions}>
          {confirmReplace ? (
            <div className={styles.confirm} role="group" aria-label={`Confirm replacing ${label}`}>
              <p>
                {label} is currently <strong>{formatCurrent(c.field, current)}</strong>. Replace it with{' '}
                <strong>{candidateValue(c)}</strong>?
              </p>
              <div className={styles.btnRow}>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={busy}
                  onClick={() => runAccept(true)}
                >
                  {accept.isPending ? <Spinner label="Replacing" /> : 'Replace existing value'}
                </Button>
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => setConfirmReplace(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : rejecting ? (
            <div className={styles.confirm} role="group" aria-label={`Reject ${label}`}>
              <label className={styles.noteLabel}>
                Note (optional)
                <input
                  type="text"
                  className={styles.noteInput}
                  value={note}
                  maxLength={500}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={busy}
                />
              </label>
              <div className={styles.btnRow}>
                <Button variant="danger" size="sm" disabled={busy} onClick={runReject}>
                  {reject.isPending ? <Spinner label="Rejecting" /> : 'Confirm reject'}
                </Button>
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => setRejecting(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className={styles.btnRow}>
              <Button
                variant="primary"
                size="sm"
                disabled={busy}
                onClick={onAcceptClick}
                aria-label={`Accept ${candidateValue(c)} for ${label}`}
              >
                {accept.isPending ? <Spinner label="Accepting" /> : 'Accept'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setError(null)
                  setConfirmReplace(false)
                  setRejecting(true)
                }}
                aria-label={`Reject ${candidateValue(c)} for ${label}`}
              >
                Reject
              </Button>
            </div>
          )}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </article>
  )
}

export function Spinner({ label }: { label: string }) {
  return (
    <span className={styles.spinnerWrap}>
      <span className={styles.spinner} aria-hidden="true" />
      <span>{label}…</span>
    </span>
  )
}
