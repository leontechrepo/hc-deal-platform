import type { ExtractionRunInfo } from '../../api/extractions'
import type { DealDocumentRow } from '../../api/dealDocuments'
import { TonedBadge } from '../ui/TonedBadge'
import {
  fmtDateTime,
  isRunActive,
  runErrorCopy,
  runStatusLabel,
  TRIGGER_LABELS,
  type Tone,
} from './extractionModel'
import styles from './Review.module.css'

function runTone(run: ExtractionRunInfo): Tone {
  if (run.status === 'error') return 'red'
  if (isRunActive(run)) return 'blue'
  return run.last_error ? 'amber' : 'green'
}

function tokens(run: ExtractionRunInfo): string {
  const t = (run.input_tokens ?? 0) + (run.output_tokens ?? 0)
  const cost = `$${(run.estimated_cost_usd ?? 0).toFixed(4)}`
  return t ? `${t.toLocaleString()} tok · ${cost}` : cost
}

export function RunHistory({
  runs,
  documents,
}: {
  runs: ExtractionRunInfo[]
  documents: DealDocumentRow[]
}) {
  const names = new Map(documents.map((d) => [d.id, d.name]))
  const docName = (id: number | string) => names.get(Number(id)) ?? `Document #${id}`

  if (runs.length === 0) {
    return <p className={styles.muted}>No extraction runs yet.</p>
  }

  const latest = runs[0]
  return (
    <details className={styles.disclosure} open={latest.status !== 'complete' || undefined}>
      <summary>Processing history ({runs.length})</summary>
      <ul className={styles.runList} aria-label="Extraction runs">
        {runs.map((run) => {
          const err = runErrorCopy(run.last_error)
          const docErrors = Object.entries(run.document_errors ?? {})
          return (
            <li key={run.id} className={styles.run}>
              <div className={styles.runTop}>
                <TonedBadge tone={runTone(run)}>{runStatusLabel(run)}</TonedBadge>
                <span className={styles.runTrigger}>{TRIGGER_LABELS[run.trigger] ?? run.trigger}</span>
                <span className={styles.muted}>
                  {fmtDateTime(run.created_at)}
                  {run.requested_by ? ` · ${run.requested_by}` : ''}
                </span>
              </div>
              <dl className={styles.runMeta}>
                <div>
                  <dt>Documents</dt>
                  <dd>
                    {(run.document_ids ?? []).length > 0
                      ? (run.document_ids ?? []).map(docName).join(', ')
                      : 'All eligible documents'}
                  </dd>
                </div>
                <div>
                  <dt>Started</dt>
                  <dd>{fmtDateTime(run.started_at)}</dd>
                </div>
                <div>
                  <dt>Finished</dt>
                  <dd>{fmtDateTime(run.finished_at)}</dd>
                </div>
                <div>
                  <dt>Retries</dt>
                  <dd>{run.retry_count}</dd>
                </div>
                <div>
                  <dt>Model</dt>
                  <dd>{run.model ?? '—'}</dd>
                </div>
                <div>
                  <dt>Usage</dt>
                  <dd>{tokens(run)}</dd>
                </div>
                <div>
                  <dt>Applied</dt>
                  <dd>{run.applied_field_count}</dd>
                </div>
              </dl>
              {err && (
                <p className={run.status === 'error' ? styles.error : styles.runNote}>{err}</p>
              )}
              {docErrors.length > 0 && (
                <ul className={styles.docErrors} aria-label="Document errors">
                  {docErrors.map(([id, code]) => (
                    <li key={id}>
                      <strong>{docName(id)}</strong>: {runErrorCopy(code)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </details>
  )
}
