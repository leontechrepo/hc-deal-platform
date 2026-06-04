import { useState } from 'react'
import { useReviewQueue, useApproveSuggestion, useRejectSuggestion } from '../../hooks/useReviewQueue'
import { StagePill } from '../DealTable/StagePill'
import { useToast } from '../Toast/Toast'
import styles from './ReviewBanner.module.css'

export function ReviewBanner() {
  const { data: suggestions = [] } = useReviewQueue()
  const approve = useApproveSuggestion()
  const reject = useRejectSuggestion()
  const { showToast } = useToast()

  if (suggestions.length === 0) return null

  return (
    <div className={styles.banner}>
      <div className={styles.header}>
        <span className={styles.badge}>{suggestions.length}</span>
        <div>
          <div className={styles.title}>AI Suggestions Awaiting Review</div>
          <div className={styles.subtitle}>Approve or reject before changes apply to the pipeline</div>
        </div>
      </div>
      <div className={styles.cards}>
        {suggestions.map(s => (
          <SuggestionCard
            key={s.id}
            id={s.id}
            companyName={s.company_name}
            stage={s.stage}
            emailSubject={s.email_subject}
            proposedValue={s.suggested_value ?? s.claude_summary ?? ''}
            onApprove={async (value) => {
              await approve.mutateAsync({ id: s.id, value })
              showToast(`Approved — ${s.company_name} updated`)
            }}
            onReject={async () => {
              await reject.mutateAsync(s.id)
              showToast(`Rejected suggestion for ${s.company_name}`)
            }}
            busy={approve.isPending || reject.isPending}
          />
        ))}
      </div>
    </div>
  )
}

interface CardProps {
  id: number
  companyName: string
  stage: string | null
  emailSubject: string | null
  proposedValue: string
  onApprove: (value: string) => Promise<void>
  onReject: () => Promise<void>
  busy: boolean
}

function SuggestionCard({ companyName, stage, emailSubject, proposedValue, onApprove, onReject, busy }: CardProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(proposedValue)

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.company}>{companyName}</span>
        <StagePill stage={stage} />
        {emailSubject && <span className={styles.emailSubject}>Re: {emailSubject}</span>}
      </div>

      <div className={styles.proposedLabel}>Proposed Update</div>
      {editing ? (
        <textarea
          className={styles.editTextarea}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => setEditing(false)}
          autoFocus
        />
      ) : (
        <div className={styles.proposedText} onClick={() => setEditing(true)} title="Click to edit before approving">
          {draft || <span style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>No value</span>}
        </div>
      )}

      <div className={styles.actions}>
        <button
          className={styles.approveBtn}
          disabled={busy}
          onClick={() => onApprove(draft)}
        >
          Approve
        </button>
        <button
          className={styles.rejectBtn}
          disabled={busy}
          onClick={onReject}
        >
          Reject
        </button>
      </div>
    </div>
  )
}
