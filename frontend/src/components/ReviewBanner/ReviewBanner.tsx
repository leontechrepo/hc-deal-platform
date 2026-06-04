import { useState } from 'react'
import type { PendingSuggestion } from '../../types'
import { useReviewQueue, useApproveSuggestion, useRejectSuggestion } from '../../hooks/useReviewQueue'
import { StagePill } from '../DealTable/StagePill'
import { useToast } from '../Toast/Toast'
import styles from './ReviewBanner.module.css'

// Group suggestions by deal_id (null deal_id = new deal, each gets its own group)
function buildGroups(suggestions: PendingSuggestion[]) {
  const groups = new Map<string, { companyName: string; stage: string | null; suggestions: PendingSuggestion[] }>()
  for (const s of suggestions) {
    const key = s.deal_id !== null ? String(s.deal_id) : `new_${s.id}`
    if (!groups.has(key)) {
      groups.set(key, { companyName: s.company_name, stage: s.stage, suggestions: [] })
    }
    groups.get(key)!.suggestions.push(s)
  }
  return groups
}

export function ReviewBanner() {
  const { data: suggestions = [] } = useReviewQueue()
  const approve = useApproveSuggestion()
  const reject = useRejectSuggestion()
  const { showToast } = useToast()

  if (suggestions.length === 0) return null

  const groups = buildGroups(suggestions)

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
        {Array.from(groups.entries()).map(([key, group]) => (
          <div key={key} className={styles.dealGroup}>
            {group.suggestions.length > 1 && (
              <div className={styles.dealGroupHeader}>
                <span className={styles.groupCompany}>{group.companyName}</span>
                {group.stage && <StagePill stage={group.stage} />}
                <span className={styles.groupCount}>{group.suggestions.length} suggestions</span>
              </div>
            )}
            {group.suggestions.map(s => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                showDealHeader={group.suggestions.length === 1}
                onApprove={async (value) => {
                  await approve.mutateAsync({ id: s.id, value })
                  if (s.suggested_field === 'new_deal') {
                    showToast(`New deal added: ${s.company_name}`)
                  } else {
                    showToast(`Approved — ${s.company_name} updated`)
                  }
                }}
                onReject={async () => {
                  await reject.mutateAsync(s.id)
                  showToast(`Rejected suggestion for ${s.company_name}`)
                }}
                busy={approve.isPending || reject.isPending}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

interface CardProps {
  suggestion: PendingSuggestion
  showDealHeader: boolean
  onApprove: (value: string) => Promise<void>
  onReject: () => Promise<void>
  busy: boolean
}

function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null) return null
  const pct = Math.round(confidence * 100)
  const cls = confidence >= 0.85 ? styles.confHigh : confidence >= 0.7 ? styles.confMed : styles.confLow
  return <span className={`${styles.confidenceBadge} ${cls}`}>{pct}% conf</span>
}

function SuggestionCard({ suggestion: s, showDealHeader, onApprove, onReject, busy }: CardProps) {
  const [draft, setDraft] = useState(s.suggested_value ?? s.claude_summary ?? '')
  const [editing, setEditing] = useState(false)

  const isNewDeal = s.suggested_field === 'new_deal'
  const isFieldUpdate = !isNewDeal && s.suggested_field !== 'commentary'

  let newDealData: { company_name?: string; sector?: string; summary?: string } = {}
  if (isNewDeal) {
    try { newDealData = JSON.parse(s.suggested_value ?? '{}') } catch { /* empty */ }
  }

  return (
    <div className={`${styles.card} ${isNewDeal ? styles.newDealCard : ''}`}>
      {showDealHeader && (
        <div className={styles.cardHeader}>
          {isNewDeal
            ? <span className={styles.newDealBadge}>New Deal Detected</span>
            : <span className={styles.company}>{s.company_name}</span>
          }
          {!isNewDeal && <StagePill stage={s.stage} />}
          {s.email_subject && <span className={styles.emailSubject}>Re: {s.email_subject}</span>}
          <ConfidenceBadge confidence={s.confidence} />
        </div>
      )}
      {!showDealHeader && (
        <div className={styles.cardSubHeader}>
          {s.email_subject && <span className={styles.emailSubject}>Re: {s.email_subject}</span>}
          <ConfidenceBadge confidence={s.confidence} />
        </div>
      )}

      {isNewDeal ? (
        <NewDealBody data={newDealData} />
      ) : isFieldUpdate ? (
        <FieldUpdateBody
          field={s.suggested_field}
          currentValue={s.current_value}
          proposedValue={s.suggested_value ?? ''}
          reasoning={s.claude_summary}
        />
      ) : (
        <CommentaryBody
          draft={draft}
          editing={editing}
          onEdit={setDraft}
          onFocus={() => setEditing(true)}
          onBlur={() => setEditing(false)}
        />
      )}

      <div className={styles.actions}>
        <button
          className={styles.approveBtn}
          disabled={busy}
          onClick={() => onApprove(isFieldUpdate || isNewDeal ? (s.suggested_value ?? '') : draft)}
        >
          {isNewDeal ? 'Add Deal' : 'Approve'}
        </button>
        <button className={styles.rejectBtn} disabled={busy} onClick={onReject}>
          Reject
        </button>
      </div>
    </div>
  )
}

function CommentaryBody({ draft, editing, onEdit, onFocus, onBlur }: {
  draft: string
  editing: boolean
  onEdit: (v: string) => void
  onFocus: () => void
  onBlur: () => void
}) {
  return (
    <>
      <div className={styles.proposedLabel}>Proposed Update</div>
      {editing ? (
        <textarea
          className={styles.editTextarea}
          value={draft}
          onChange={e => onEdit(e.target.value)}
          onBlur={onBlur}
          autoFocus
        />
      ) : (
        <div className={styles.proposedText} onClick={onFocus} title="Click to edit before approving">
          {draft || <span style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>No value</span>}
        </div>
      )}
    </>
  )
}

function FieldUpdateBody({ field, currentValue, proposedValue, reasoning }: {
  field: string
  currentValue: string | null
  proposedValue: string
  reasoning: string | null
}) {
  return (
    <div className={styles.fieldUpdateBody}>
      <div className={styles.fieldLabel}>Field: <span className={styles.fieldName}>{field}</span></div>
      <div className={styles.fieldValues}>
        <span className={styles.currentVal}>{currentValue || <em>empty</em>}</span>
        <span className={styles.arrow}>→</span>
        <span className={styles.proposedVal}>{proposedValue}</span>
      </div>
      {reasoning && <div className={styles.reasoning}>{reasoning}</div>}
    </div>
  )
}

function NewDealBody({ data }: { data: { company_name?: string; sector?: string; summary?: string } }) {
  return (
    <div className={styles.newDealBody}>
      <div className={styles.newDealName}>{data.company_name}</div>
      {data.sector && <div className={styles.newDealSector}>{data.sector}</div>}
      {data.summary && <div className={styles.newDealSummary}>{data.summary}</div>}
    </div>
  )
}
