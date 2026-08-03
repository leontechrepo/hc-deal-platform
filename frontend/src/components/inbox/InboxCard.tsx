import { useEffect, useState } from 'react'
import { Card } from '../ui/Card/Card'
import { ConfidenceBadge } from '../ui/ConfidenceBadge/ConfidenceBadge'
import { ApproveRejectActions } from '../ui/ApproveRejectActions/ApproveRejectActions'
import { PipelineStageBadge } from '../shared/PipelineStageBadge'
import { AssignToDealControl } from './AssignToDealControl'
import { SearchableSelect } from '../ui/SearchableSelect/SearchableSelect'
import { useDeals } from '../../hooks/useDeals'
import type { PendingSuggestion } from '../../types'
import styles from './InboxCard.module.css'

interface Props {
  suggestion: PendingSuggestion
  onApprove: (value: string, dealId: string | null) => Promise<void>
  onReject: () => Promise<void>
  busy: boolean
}

export function InboxCard({ suggestion: s, onApprove, onReject, busy }: Props) {
  const isNewDeal = s.suggested_field === 'new_deal'
  const isFieldUpdate = !isNewDeal && s.suggested_field !== 'commentary'

  const [draft, setDraft] = useState(s.suggested_value ?? s.claude_summary ?? '')
  const [editing, setEditing] = useState(false)
  const [mappedDealId, setMappedDealId] = useState<string | null>(s.deal_id !== null ? String(s.deal_id) : null)
  const { data: deals = [] } = useDeals()

  useEffect(() => {
    setDraft(s.suggested_value ?? s.claude_summary ?? '')
  }, [s.suggested_value, s.claude_summary])

  useEffect(() => {
    setMappedDealId(s.deal_id !== null ? String(s.deal_id) : null)
  }, [s.deal_id])

  let newDealData: { company_name?: string; sector?: string; summary?: string } = {}
  if (isNewDeal) {
    try { newDealData = JSON.parse(s.suggested_value ?? '{}') } catch { /* empty */ }
  }

  const originalDealId = s.deal_id !== null ? String(s.deal_id) : null
  const remapped = !isNewDeal && mappedDealId !== null && mappedDealId !== originalDealId
  const mappedDeal = remapped ? deals.find(d => String(d.id) === mappedDealId) : undefined
  const displayedCurrentValue = mappedDeal
    ? String((mappedDeal as unknown as Record<string, unknown>)[s.suggested_field] ?? '')
    : s.current_value

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
            <span className={styles.currentVal}>{displayedCurrentValue || <em>empty</em>}</span>
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

      {!isNewDeal && (
        <div className={styles.dealMapRow}>
          <span className={styles.dealMapLabel}>Deal:</span>
          <div className={styles.dealMapSelect}>
            <SearchableSelect
              options={deals.map(d => ({ id: String(d.id), label: d.company_name }))}
              value={mappedDealId}
              onChange={setMappedDealId}
              noneLabel="Select deal…"
              placeholder="Search deals…"
            />
          </div>
        </div>
      )}

      <ApproveRejectActions
        busy={busy || (!isNewDeal && mappedDealId === null)}
        approveLabel={isNewDeal ? 'Add Deal' : 'Approve'}
        onApprove={() => onApprove(isFieldUpdate || isNewDeal ? (s.suggested_value ?? '') : draft, isNewDeal ? null : mappedDealId)}
        onReject={onReject}
      />

      {isNewDeal && <AssignToDealControl suggestionId={s.id} companyName={newDealData.company_name ?? s.company_name} />}
    </Card>
  )
}
