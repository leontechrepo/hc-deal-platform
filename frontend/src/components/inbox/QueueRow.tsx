import { Paperclip } from 'lucide-react'
import type { InboxGroup } from '../../api/inbox'
import { groupTopConfidence } from '../../pages/InboxPage/inboxFilters'
import { ConfidenceChip } from './ConfidenceChip'
import { attachmentStateCopy, senderLabel, summariseKinds } from './inboxCopy'
import pageStyles from '../../pages/InboxPage/InboxPage.module.css'

export function QueueRow({
  group,
  isActive,
  ingestionEnabled,
  onSelect,
}: {
  group: InboxGroup
  isActive: boolean
  ingestionEnabled: boolean | undefined
  onSelect: () => void
}) {
  const when = group.received_at
    ? new Date(group.received_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—'
  const stateCopy = attachmentStateCopy(group.attachment_state, ingestionEnabled)
  // Only a failure is loud; everything else is a quiet paperclip with a count.
  const failed = group.attachment_state === 'failed'
  const clipClass = failed ? `${pageStyles.clip} ${pageStyles.clipBad}` : pageStyles.clip
  const subject = group.email_subject ?? '(no subject)'

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isActive ? 'true' : undefined}
      aria-label={`${subject}, from ${senderLabel(group.email_from, group.email_from_name)}, ${group.suggestions.length} suggestion${group.suggestions.length === 1 ? '' : 's'}`}
      className={isActive ? `${pageStyles.row} ${pageStyles.rowActive}` : pageStyles.row}
    >
      <span className={pageStyles.rowSubject}>{subject}</span>
      <span className={pageStyles.rowMeta}>
        <span>{senderLabel(group.email_from, group.email_from_name)}</span>
        <span>{when}</span>
      </span>
      <span className={pageStyles.rowFoot}>
        <span>{summariseKinds(group.suggestions)}</span>
        {group.has_attachments && (
          <span className={clipClass} title={stateCopy?.detail}>
            <Paperclip size={12} aria-hidden />
            {group.attachment_count > 0 ? group.attachment_count : ''}
            {failed ? ' · failed' : ''}
          </span>
        )}
        <ConfidenceChip value={groupTopConfidence(group)} />
      </span>
    </button>
  )
}
