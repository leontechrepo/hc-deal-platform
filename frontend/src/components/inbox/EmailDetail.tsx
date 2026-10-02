import { MailX } from 'lucide-react'
import type { AcceptGroupResult, InboxGroup } from '../../api/inbox'
import { useEmailBody } from '../../hooks/useInbox'
import { EMAIL_BODY_UNAVAILABLE, formatReceived } from './inboxCopy'
import { AttachmentsSection } from './AttachmentsSection'
import { ReviewForm } from './ReviewForm'
import styles from './Inbox.module.css'

export function EmailDetail({
  group,
  ingestionEnabled,
  onApplied,
  onDismissed,
}: {
  group: InboxGroup
  ingestionEnabled: boolean | undefined
  onApplied?: (result: AcceptGroupResult) => void
  onDismissed?: (count: number) => void
}) {
  const body = useEmailBody(group.id)
  const received = formatReceived(group.received_at)
  const sender = group.email_from_name
    ? `${group.email_from_name}${group.email_from ? ` <${group.email_from}>` : ''}`
    : (group.email_from ?? 'unknown sender')

  return (
    <>
      <section className={`${styles.panel} ${styles.section}`} aria-label="Original email">
        <h3 className={styles.sectionTitle}>Original email</h3>
        <h2 className={styles.subject}>{group.email_subject ?? '(no subject)'}</h2>
        <div className={styles.metaRow}>
          <span>From <strong>{sender}</strong></span>
          {group.mailbox && <span>Mailbox <strong>{group.mailbox}</strong></span>}
          {received && <span>Received <strong>{received}</strong></span>}
        </div>
        {group.source_removed && (
          <div className={`${styles.notice} ${styles.noticeWarn}`} role="note">
            <MailX size={14} aria-hidden />
            <div className={styles.noticeBody}>
              The source email was deleted from the mailbox. The proposed changes and any stored
              attachments below are kept for review.
            </div>
          </div>
        )}
        {body.data?.available && body.data.body ? (
          <>
            <pre className={styles.emailBody} aria-label="Email body" tabIndex={0}>
              {body.data.body}
            </pre>
            {body.data.truncated && <p className={styles.hint}>Long email — showing the first part.</p>}
          </>
        ) : (
          <>
            {group.email_snippet ? (
              <p className={styles.snippet}>{group.email_snippet}</p>
            ) : (
              <p className={styles.hint}>No message preview was captured.</p>
            )}
            <p className={styles.hint} role="status">
              {body.isLoading
                ? 'Loading the full email…'
                : EMAIL_BODY_UNAVAILABLE[body.data?.reason ?? 'graph_error'] ??
                  'Only the stored preview is shown.'}
            </p>
          </>
        )}
      </section>

      <AttachmentsSection group={group} ingestionEnabled={ingestionEnabled} />

      <ReviewForm key={group.id} group={group} onApplied={onApplied} onDismissed={onDismissed} />
    </>
  )
}
