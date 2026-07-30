import { useEffect, useState } from 'react'
import { Card } from '../ui/Card/Card'
import { ConfidenceBadge } from '../ui/ConfidenceBadge/ConfidenceBadge'
import { ApproveRejectActions } from '../ui/ApproveRejectActions/ApproveRejectActions'
import { PipelineStageBadge } from '../shared/PipelineStageBadge'
import { AssignToDealControl } from './AssignToDealControl'
import type { PendingSuggestion } from '../../types'
import styles from './InboxCard.module.css'

interface Props {
  suggestion: PendingSuggestion
  onApprove: (value: string) => Promise<void>
  onReject: () => Promise<void>
  busy: boolean
}

export function InboxCard({ suggestion: s, onApprove, onReject, busy }: Props) {
  const isNewDeal = s.suggested_field === 'new_deal'
  const isFieldUpdate = !isNewDeal && s.suggested_field !== 'commentary'

  const [draft, setDraft] = useState(s.suggested_value ?? s.claude_summary ?? '')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    setDraft(s.suggested_value ?? s.claude_summary ?? '')
  }, [s.suggested_value, s.claude_summary])

  let newDealData: { company_name?: string; sector?: string; summary?: string } = {}
  if (isNewDeal) {
    try { newDealData = JSON.parse(s.suggested_value ?? '{}') } catch { /* empty */ }
  }

  return (
    <Card className={`${styles.card} ${isNewDeal ? styles.newDealCard : ''}`}>
      <div className={styles.header}>
        {isNewDeal
          ? <span className={styles.newDealBadge}>New Deal Detected</span>
          : <span className={styles.company}>{s.company_name}</span>
        }
        <PipelineStageBadge stage={s.pipeline_stage} />
        {s.email_subject && <span className={styles.emailSubject}>Re: {s.email_subject}</span>}
        <ConfidenceBadge confidence={s.confidence} />
      </div>

      {s.email_snippet && <div className={styles.emailSnippet}>{s.email_snippet}</div>}

      {isNewDeal ? (
        <div className={styles.newDealBody}>
          <div className={styles.newDealName}>{newDealData.company_name}</div>
          {(newDealData.sector || s.estimated_sector) && (
            <div className={styles.newDealSector}>{newDealData.sector ?? s.estimated_sector}</div>
          )}
          {s.estimated_size_m !== null && (
            <div className={styles.newDealSize}>Estimated size: ${s.estimated_size_m.toFixed(1)}M</div>
          )}
          {newDealData.summary && <div className={styles.newDealSummary}>{newDealData.summary}</div>}
        </div>
      ) : isFieldUpdate ? (
        <div className={styles.fieldUpdateBody}>
          <div className={styles.fieldLabel}>Field: <span className={styles.fieldName}>{s.suggested_field}</span></div>
          <div className={styles.fieldValues}>
            <span className={styles.currentVal}>{s.current_value || <em>empty</em>}</span>
            <span className={styles.arrow}>→</span>
            <span className={styles.proposedVal}>{s.suggested_value}</span>
          </div>
          {s.claude_summary && <div className={styles.reasoning}>{s.claude_summary}</div>}
        </div>
      ) : (
        <>
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
              {draft || <span className={styles.noValue}>No value</span>}
            </div>
          )}
        </>
      )}

      <ApproveRejectActions
        busy={busy}
        approveLabel={isNewDeal ? 'Add Deal' : 'Approve'}
        onApprove={() => onApprove(isFieldUpdate || isNewDeal ? (s.suggested_value ?? '') : draft)}
        onReject={onReject}
      />

      {isNewDeal && <AssignToDealControl suggestionId={s.id} companyName={newDealData.company_name ?? s.company_name} />}
    </Card>
  )
}
