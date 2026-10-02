import { ChevronDown, ChevronUp, FileText, Paperclip } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { InboxGroup } from '../../api/inbox'
import { TonedBadge } from '../ui/TonedBadge'
import {
  attachmentStateCopy,
  attachmentTally,
  dispositionCopy,
  formatBytes,
  groupDocumentFor,
} from './inboxCopy'
import styles from './Inbox.module.css'

/**
 * Attachments, triaged: only things that need a person get a badge (a failed
 * fetch, or a stored file that is still unfiled). Everything informational —
 * stored, filed, skipped, duplicate — is plain muted text, so the eye lands on
 * the rows that matter.
 */
export function AttachmentsSection({
  group,
  ingestionEnabled,
}: {
  group: InboxGroup
  /** From /api/meta/features; undefined while it loads. */
  ingestionEnabled: boolean | undefined
}) {
  const [open, setOpen] = useState(false)
  if (!group.has_attachments && group.attachment_state === 'none') return null

  const stateCopy = attachmentStateCopy(group.attachment_state, ingestionEnabled)
  const entries = group.attachment_summary ?? []
  const linkedIds = new Set(entries.map((e) => e.document_id).filter((id) => id != null))
  const extraDocs = group.documents.filter((d) => !linkedIds.has(d.id))
  const tally = attachmentTally(entries, group.documents)
  const problem = group.attachment_state === 'failed'
  const total = group.attachment_count || entries.length
  const failedCount = entries.filter((e) => e.disposition === 'failed').length

  return (
    <section className={styles.section} aria-label="Attachments">
      <button
        type="button"
        className={styles.attachToggle}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.sectionTitle}>
          <Paperclip size={11} aria-hidden /> Attachments ({total})
        </span>
        {failedCount > 0 && <TonedBadge tone="red">{failedCount} failed</TonedBadge>}
        {tally.unfiled > 0 && <TonedBadge tone="amber">{tally.unfiled} to file</TonedBadge>}
        <span className={styles.attachSummaryInline}>
          {problem || group.attachment_state === 'disabled' ? stateCopy?.detail : stateCopy?.label === 'Pending' ? stateCopy.detail : tally.text}
        </span>
        <span className={styles.summaryCta}>
          {open ? 'Hide' : 'Show'} {open ? <ChevronUp size={13} aria-hidden /> : <ChevronDown size={13} aria-hidden />}
        </span>
      </button>

      {open && (
        <>
      {/* One summary line; red only when something failed or needs filing. */}
      {problem || group.attachment_state === 'disabled' ? (
        <div
          className={`${styles.notice} ${problem ? styles.noticeError : styles.noticeWarn}`}
          data-testid="attachment-state"
          data-state={group.attachment_state}
        >
          <div className={styles.noticeBody}>{stateCopy?.detail}</div>
        </div>
      ) : (
        <p className={styles.attachSummary} data-testid="attachment-state" data-state={group.attachment_state}>
          {tally.unfiled > 0 && (
            <strong className={styles.attachAction}>
              {tally.unfiled} file{tally.unfiled === 1 ? '' : 's'} to file to a deal ·{' '}
            </strong>
          )}
          {stateCopy?.label === 'Pending' ? stateCopy.detail : tally.text}
        </p>
      )}

      {entries.length > 0 && (
        <ul className={styles.attachList}>
          {entries.map((entry, i) => {
            const d = dispositionCopy(entry)
            const doc = groupDocumentFor(group, entry)
            const failed = entry.disposition === 'failed'
            const unfiled = Boolean(doc && !doc.filed)
            return (
              <li className={styles.attachItem} key={`${entry.graph_attachment_id ?? entry.name ?? 'att'}-${i}`}>
                <span className={styles.attachName}>
                  {entry.name ?? '(unnamed attachment)'}
                  {entry.inline ? ' · inline' : ''}
                </span>
                {failed && <TonedBadge tone="red">Failed</TonedBadge>}
                {!failed && unfiled && <TonedBadge tone="amber">Needs filing</TonedBadge>}
                {doc?.human_review_required && <TonedBadge tone="amber">Needs review</TonedBadge>}
                <span className={styles.attachSub}>
                  {failed ? d.detail : doc ? (doc.filed ? 'Filed to a deal' : 'Stored, not yet filed to a deal') : d.detail}
                  {entry.size != null ? ` · ${formatBytes(entry.size)}` : ''}
                  {doc?.filed && doc.deal_id && (
                    <>
                      {' · '}
                      <Link to={`/deals/${doc.deal_id}?tab=documents`}>View in deal</Link>
                    </>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {extraDocs.length > 0 && (
        <ul className={styles.attachList}>
          {extraDocs.map((doc) => (
            <li className={styles.attachItem} key={`doc-${doc.id}`}>
              <span className={styles.attachName}>
                <FileText size={12} aria-hidden /> {doc.name}
              </span>
              {!doc.filed && <TonedBadge tone="amber">Needs filing</TonedBadge>}
              <span className={styles.attachSub}>
                {doc.filed ? 'Filed to a deal' : 'Stored, not yet filed to a deal'}
                {doc.size_bytes != null ? ` · ${formatBytes(doc.size_bytes)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
        </>
      )}
    </section>
  )
}
