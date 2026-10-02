import type { DealDocumentRow } from '../../api/dealDocuments'
import { TonedBadge } from '../ui/TonedBadge'
import { Button } from '../ui/Button/Button'
import { Tag } from '../ui/Tag/Tag'
import { fmtDateTime, skipReasonCopy, type Tone } from './extractionModel'
import styles from './DocumentsTable.module.css'

function fmtSize(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ProcessingBadge({ doc }: { doc: DealDocumentRow }) {
  const n = doc.pending_review_count ?? 0
  let tone: Tone = 'gray'
  let text = '—'
  switch (doc.processing_status) {
    case 'needs_review':
      tone = 'amber'
      text = n > 0 ? `Needs review (${n})` : 'Needs review'
      break
    case 'extracted':
      tone = 'green'
      text = n > 0 ? `Needs review (${n})` : 'Extracted'
      if (n > 0) tone = 'amber'
      break
    case 'pending':
      tone = 'blue'
      text = 'Pending'
      break
    case 'failed':
      tone = 'red'
      text = 'Failed'
      break
    case 'skipped':
      text = 'Skipped'
      break
    default:
      if (doc.processing_status) text = doc.processing_status
  }
  return <TonedBadge tone={tone}>{text}</TonedBadge>
}

function Provenance({ doc }: { doc: DealDocumentRow }) {
  const e = doc.source_email
  if (!e) {
    return <span>{doc.uploaded_by ? `Uploaded by ${doc.uploaded_by}` : 'Manual upload'}</span>
  }
  const who = e.sender_name || e.sender || 'Unknown sender'
  const title = [
    e.subject ? `Subject: ${e.subject}` : null,
    e.sender ? `From: ${e.sender}` : null,
    e.received_at ? `Received: ${fmtDateTime(e.received_at)}` : null,
    e.source_removed ? 'The source email has been removed from the mailbox' : null,
  ]
    .filter(Boolean)
    .join('\n')
  return (
    <span title={title}>
      <span>{e.subject || '(no subject)'}</span>
      <span className={styles.sub}>
        from {who}
        {e.source_removed ? ' · source email removed' : ''}
      </span>
    </span>
  )
}

interface Props {
  documents: DealDocumentRow[]
  selected: Set<number>
  onToggle: (id: number) => void
  onToggleAll: (checked: boolean) => void
  highlightId: number | null
  extractionEnabled: boolean
  patchPending: boolean
  deletePending: boolean
  downloadingId: number | null
  onDownload: (d: DealDocumentRow) => void
  onDelete: (d: DealDocumentRow) => void
  onFlagReview: (d: DealDocumentRow, checked: boolean) => void
}

export function DocumentsTable(p: Props) {
  const allSelected = p.documents.length > 0 && p.documents.every((d) => p.selected.has(d.id))
  return (
    <div className={styles.wrap}>
      <table className={styles.table} aria-label="Deal documents">
        <thead>
          <tr>
            <th scope="col">
              <input
                type="checkbox"
                aria-label="Select all documents"
                checked={allSelected}
                onChange={(e) => p.onToggleAll(e.target.checked)}
              />
            </th>
            <th scope="col">Name</th>
            <th scope="col">Category</th>
            <th scope="col">Source</th>
            <th scope="col">Processing</th>
            <th scope="col">Size</th>
            <th scope="col">Date</th>
            <th scope="col">Review</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {p.documents.map((d) => {
            const skip = skipReasonCopy(d.skip_reason)
            return (
              <tr
                key={d.id}
                id={`document-row-${d.id}`}
                className={styles.row}
                tabIndex={-1}
                data-highlight={p.highlightId === d.id}
              >
                <td data-label="">
                  <input
                    type="checkbox"
                    aria-label={`Select ${d.name}`}
                    checked={p.selected.has(d.id)}
                    onChange={() => p.onToggle(d.id)}
                  />
                </td>
                <td data-label="Name" className={styles.name}>
                  {d.name}
                </td>
                <td data-label="Category">{d.category ? <Tag>{d.category}</Tag> : '—'}</td>
                <td data-label="Source">
                  <Provenance doc={d} />
                </td>
                <td data-label="Processing">
                  <span className={styles.statusCell}>
                    <ProcessingBadge doc={d} />
                    {skip && <span className={styles.sub}>{skip}</span>}
                  </span>
                </td>
                <td data-label="Size">{fmtSize(d.size_bytes)}</td>
                <td data-label="Date">{fmtDateTime(d.created_at)}</td>
                <td data-label="Review">
                  {p.extractionEnabled ? (
                    <label className={styles.flag}>
                      <input
                        type="checkbox"
                        checked={d.human_review_required}
                        disabled={p.patchPending}
                        onChange={(e) => p.onFlagReview(d, e.target.checked)}
                      />
                      Flag for review
                    </label>
                  ) : (
                    '—'
                  )}
                </td>
                <td data-label="">
                  <div className={styles.actions}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => p.onDownload(d)}
                      disabled={p.downloadingId === d.id}
                      aria-label={`Download ${d.name}`}
                    >
                      {p.downloadingId === d.id ? 'Downloading…' : 'Download'}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => p.onDelete(d)}
                      disabled={p.deletePending}
                      aria-label={`Delete ${d.name}`}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
