import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { useId, useState } from 'react'
import type { AcceptGroupResult, InboxGroup, PendingSuggestion } from '../../api/inbox'
import { useAcceptInboxGroup, useDismissInboxGroup } from '../../hooks/useInbox'
import { PIPELINE_STAGE_LABEL, PIPELINE_STAGES, STATUSES } from '../../domain/stages'
import { Button } from '../ui/Button/Button'
import { DealSearchSelect } from '../ui/DealSearchSelect'
import { TonedBadge } from '../ui/TonedBadge'
import { ConfidenceChip } from './ConfidenceChip'
import { fieldLabel, formatFieldValue, suggestionKind } from './inboxCopy'
import {
  blockingReason,
  buildAcceptBody,
  includedCount,
  initialReviewState,
  isLowConfidence,
  lowestConfidence,
  parseAcceptError,
  splitSuggestions,
  type AcceptFailure,
  type ReviewState,
} from './reviewState'
import styles from './Inbox.module.css'

function enumOptions(field: string) {
  if (field === 'pipeline_stage') {
    return PIPELINE_STAGES.map((s) => ({ value: s, label: PIPELINE_STAGE_LABEL[s] ?? s }))
  }
  if (field === 'status') return STATUSES.map((s) => ({ value: s, label: s }))
  return null
}

function FieldRow({
  suggestion,
  value,
  included,
  error,
  disabled,
  onValue,
  onIncluded,
}: {
  suggestion: PendingSuggestion
  value: string
  included: boolean
  error: string | undefined
  disabled: boolean
  onValue: (v: string) => void
  onIncluded: (v: boolean) => void
}) {
  const uid = useId()
  const label = fieldLabel(suggestion.suggested_field)
  const options = enumOptions(suggestion.suggested_field)
  const isCommentary = suggestionKind(suggestion) === 'commentary'
  const multiline = isCommentary || value.includes('\n') || value.length > 96
  const low = isLowConfidence(suggestion)
  const current = formatFieldValue(suggestion.suggested_field, suggestion.current_value)
  const rowClass = [
    styles.fieldRow,
    low ? styles.fieldLow : '',
    error ? styles.fieldError : '',
    included ? '' : styles.fieldOff,
  ].join(' ')

  return (
    <li className={rowClass} data-testid={`field-${suggestion.suggested_field}`}>
      <input
        type="checkbox"
        className={styles.fieldCheck}
        checked={included}
        disabled={disabled}
        onChange={(e) => onIncluded(e.target.checked)}
        aria-label={`Apply ${label}`}
      />
      <div className={styles.fieldMain}>
        <div className={styles.fieldHead}>
          <label htmlFor={`${uid}-v`} className={styles.fieldLabel}>
            {label}
          </label>
          {low && (
            <span title="The model guessed this from thin wording. Check it against the evidence.">
              <TonedBadge tone="amber" className={styles.nowrap}>
                <AlertTriangle size={11} aria-hidden /> Weak
              </TonedBadge>
            </span>
          )}
          {suggestion.requires_attention && (
            <span title="A large move relative to the current value.">
              <TonedBadge tone="amber">Large move</TonedBadge>
            </span>
          )}
          <span className={styles.fieldCurrent}>
            {isCommentary ? 'appended to commentary' : `now: ${current || 'empty'}`}
          </span>
        </div>

        {options ? (
          <select
            id={`${uid}-v`}
            className={styles.proposedInput}
            value={value}
            disabled={disabled || !included}
            onChange={(e) => onValue(e.target.value)}
          >
            {!options.some((o) => o.value === value) && <option value={value}>{value || 'Choose…'}</option>}
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : multiline ? (
          <textarea
            id={`${uid}-v`}
            className={styles.proposedText}
            rows={4}
            value={value}
            disabled={disabled || !included}
            onChange={(e) => onValue(e.target.value)}
          />
        ) : (
          <input
            id={`${uid}-v`}
            className={styles.proposedInput}
            value={value}
            disabled={disabled || !included}
            onChange={(e) => onValue(e.target.value)}
          />
        )}

        {suggestion.evidence && (
          <blockquote className={styles.evidence}>
            <span className={styles.evidenceLabel}>Evidence from the email</span>
            {suggestion.evidence}
          </blockquote>
        )}
        {error && (
          <p className={styles.fieldErrorText} role="alert">
            {error}
          </p>
        )}
      </div>
    </li>
  )
}

/**
 * One editable form per email: the proposed deal (or the proposed changes to
 * one deal) pre-filled from the message, a single confidence badge, and one
 * apply / dismiss action. Weak fields are flagged inline rather than gated.
 */
export function ReviewForm({
  group,
  onApplied,
  onDismissed,
}: {
  group: InboxGroup
  onApplied?: (result: AcceptGroupResult) => void
  onDismissed?: (count: number) => void
}) {
  const accept = useAcceptInboxGroup()
  const dismiss = useDismissInboxGroup()
  const parts = splitSuggestions(group)
  const [state, setState] = useState<ReviewState>(() => initialReviewState(group))
  const [failure, setFailure] = useState<AcceptFailure | null>(null)
  const [confirmDismiss, setConfirmDismiss] = useState(false)
  const [done, setDone] = useState<AcceptGroupResult | null>(null)
  const [open, setOpen] = useState(false)

  const busy = accept.isPending || dismiss.isPending
  const isNew = parts.newDeal !== null
  const blocked = blockingReason(parts, state)
  const count = includedCount(parts, state)
  const flagged = parts.updates.filter(isLowConfidence).length + (parts.newDeal && isLowConfidence(parts.newDeal) ? 1 : 0)
  const total = group.suggestions.length
  const patch = (p: Partial<ReviewState>) => setState((s) => ({ ...s, ...p }))
  const draft = state.newDeal
  const setDraft = (p: Partial<typeof draft>) => patch({ newDeal: { ...draft, ...p } })

  const primaryLabel = accept.isPending
    ? 'Applying…'
    : isNew
      ? state.linkMode
        ? 'Link to deal'
        : 'Create deal'
      : `Apply ${count} change${count === 1 ? '' : 's'}`

  async function apply() {
    setFailure(null)
    try {
      const result = await accept.mutateAsync({ groupId: group.id, body: buildAcceptBody(parts, state) })
      setDone(result)
      onApplied?.(result)
    } catch (err) {
      const f = parseAcceptError(err)
      setFailure(f)
      if (f.needsReasoning === 'stage_skip') patch({ allowStageSkip: true })
    }
  }

  async function dismissAll() {
    setConfirmDismiss(false)
    setFailure(null)
    try {
      await dismiss.mutateAsync({ groupId: group.id })
      onDismissed?.(total)
    } catch (err) {
      setFailure({ rows: {}, general: `Dismiss failed: ${parseAcceptError(err).general}`, needsReasoning: null })
    }
  }

  const needsReason = failure?.needsReasoning != null
  const rowErrors = failure?.rows ?? {}

  const heading = isNew
    ? draft.company_name || 'Untitled deal'
    : (group.deal_name ?? parts.updates[0]?.company_name ?? 'Choose a deal')

  if (!open) {
    const changes = parts.updates.length
    return (
      <section className={`${styles.card} ${flagged > 0 ? styles.cardAttention : ''}`} aria-label="Review">
        <button
          type="button"
          className={styles.summaryRow}
          aria-expanded={false}
          onClick={() => setOpen(true)}
        >
          <span className={styles.cardKind}>{isNew ? 'New deal detected' : 'Proposed update'}</span>
          <span className={styles.cardTitle}>
            {isNew
              ? heading
              : `${changes} change${changes === 1 ? '' : 's'}${group.deal_name ? ` · ${group.deal_name}` : ''}`}
            {isNew && changes > 0 ? ` · +${changes} field${changes === 1 ? '' : 's'}` : ''}
          </span>
          <span className={styles.spacer} />
          {flagged > 0 && (
            <TonedBadge tone="amber" className={styles.nowrap}>
              <AlertTriangle size={11} aria-hidden /> {flagged} flagged
            </TonedBadge>
          )}
          <ConfidenceChip
            value={lowestConfidence(group.suggestions)}
            scope={total > 1 ? `lowest of ${total} proposed values` : undefined}
          />
          <span className={styles.summaryCta}>
            {isNew ? 'Review & Create Deal' : 'Review & Update Deal'} <ChevronDown size={13} aria-hidden />
          </span>
        </button>
      </section>
    )
  }

  return (
    <section className={`${styles.card} ${flagged > 0 ? styles.cardAttention : ''}`} aria-label="Review">
      <div className={styles.cardHead}>
        <span className={styles.cardKind}>{isNew ? 'New deal' : 'Proposed update'}</span>
        <span className={styles.cardTitle}>{heading}</span>
        <span className={styles.spacer} />
        <ConfidenceChip
          value={lowestConfidence(group.suggestions)}
          scope={total > 1 ? `lowest of ${total} proposed values` : undefined}
        />
        <Button variant="ghost" size="sm" type="button" aria-expanded onClick={() => setOpen(false)}>
          Collapse <ChevronUp size={13} aria-hidden />
        </Button>
      </div>

      {/* Actions sit at the top so they are reachable without scrolling a long form. */}
      <div className={styles.actions}>
        {confirmDismiss ? (
          <>
            <span className={styles.actionNote} role="alertdialog" aria-label="Confirm dismiss">
              Dismiss {total === 1 ? 'this suggestion' : `all ${total} suggestions`} from this email? They leave the queue.
            </span>
            <Button variant="danger" size="sm" type="button" onClick={dismissAll}>
              Confirm dismiss
            </Button>
            <Button variant="ghost" size="sm" type="button" onClick={() => setConfirmDismiss(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <span className={styles.actionNote} role="status">
              {blocked ??
                (flagged > 0
                  ? `${flagged} value${flagged === 1 ? ' is' : 's are'} flagged — check ${flagged === 1 ? 'it' : 'them'} against the evidence.`
                  : '')}
            </span>
            <Button variant="ghost" size="sm" type="button" disabled={busy} onClick={() => setConfirmDismiss(true)}>
              {dismiss.isPending ? 'Dismissing…' : 'Dismiss'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="button"
              disabled={busy || blocked !== null || (needsReason && !state.reasoning.trim())}
              onClick={apply}
            >
              {primaryLabel}
            </Button>
          </>
        )}
      </div>

      <div className={styles.cardBody}>
        {group.suggestions.find((s) => s.claude_summary)?.claude_summary && (
          <p className={styles.summary}>{group.suggestions.find((s) => s.claude_summary)?.claude_summary}</p>
        )}

        {isNew && (
          <div className={styles.dealForm}>
            {state.linkMode ? (
              <div className={styles.retarget}>
                <span className={styles.cellLabel}>Link to an existing deal instead</span>
                <DealSearchSelect
                  value={state.linkedDealId}
                  onChange={(id) => patch({ linkedDealId: id })}
                  disabled={busy}
                  ariaLabel="Existing deal to link"
                />
              </div>
            ) : (
              <>
                <label className={styles.formField}>
                  <span className={styles.cellLabel}>Company name</span>
                  <input
                    className={styles.proposedInput}
                    value={draft.company_name}
                    disabled={busy}
                    onChange={(e) => setDraft({ company_name: e.target.value })}
                  />
                </label>
                <label className={styles.formField}>
                  <span className={styles.cellLabel}>Sector</span>
                  <input
                    className={styles.proposedInput}
                    value={draft.sector}
                    disabled={busy}
                    onChange={(e) => setDraft({ sector: e.target.value })}
                  />
                </label>
                <label className={styles.formField}>
                  <span className={styles.cellLabel}>Facility size ($M)</span>
                  <input
                    className={styles.proposedInput}
                    inputMode="decimal"
                    value={draft.deal_size_m}
                    placeholder="e.g. 40"
                    disabled={busy}
                    onChange={(e) => setDraft({ deal_size_m: e.target.value })}
                  />
                </label>
                <label className={`${styles.formField} ${styles.formWide}`}>
                  <span className={styles.cellLabel}>Summary</span>
                  <textarea
                    className={styles.proposedText}
                    rows={3}
                    value={draft.summary}
                    disabled={busy}
                    onChange={(e) => setDraft({ summary: e.target.value })}
                  />
                </label>
              </>
            )}
            <div className={styles.formWide}>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                disabled={busy}
                onClick={() => patch({ linkMode: !state.linkMode, linkedDealId: null })}
              >
                {state.linkMode ? 'Create a new deal instead' : 'Link to an existing deal instead'}
              </Button>
            </div>
          </div>
        )}

        {!isNew && parts.updates.length > 0 && (
          <div className={styles.retarget}>
            <span className={styles.cellLabel}>Deal these changes apply to</span>
            <DealSearchSelect
              value={state.dealId}
              initialLabel={group.deal_name ?? parts.updates[0]?.company_name}
              onChange={(id) => patch({ dealId: id })}
              disabled={busy}
              placeholder="Pick a deal…"
              ariaLabel="Deal these changes apply to"
            />
          </div>
        )}

        {parts.updates.length > 0 && (
          <>
            {isNew && <span className={styles.cellLabel}>Also proposed for the new deal</span>}
            <ul className={styles.fieldList}>
              {parts.updates.map((s) => (
                <FieldRow
                  key={s.id}
                  suggestion={s}
                  value={state.values[s.id] ?? s.suggested_value ?? ''}
                  included={state.included[s.id] ?? true}
                  error={rowErrors[s.id]?.message}
                  disabled={busy}
                  onValue={(v) => patch({ values: { ...state.values, [s.id]: v } })}
                  onIncluded={(v) => patch({ included: { ...state.included, [s.id]: v } })}
                />
              ))}
            </ul>
          </>
        )}

        {Object.values(rowErrors).some((e) => e.status === 409) && (
          <div className={`${styles.notice} ${styles.noticeWarn}`} role="note">
            <AlertTriangle size={14} aria-hidden />
            <div className={styles.noticeBody}>
              Underwriting fields are locked at this stage. Untick the locked change to apply the rest.
            </div>
          </div>
        )}

        {needsReason && (
          <div className={styles.reasoning}>
            <label className={styles.cellLabel} htmlFor="review-reason">
              {failure?.needsReasoning === 'stage_skip'
                ? 'Why is this stage jump correct?'
                : 'Reasoning for this status change'}
            </label>
            <textarea
              id="review-reason"
              className={styles.proposedText}
              rows={3}
              value={state.reasoning}
              disabled={busy}
              onChange={(e) => patch({ reasoning: e.target.value })}
            />
          </div>
        )}

        {failure && Object.keys(rowErrors).length > 0 && (
          <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
            <AlertTriangle size={14} aria-hidden />
            <div className={styles.noticeBody}>
              Nothing was applied. Fix the highlighted {Object.keys(rowErrors).length === 1 ? 'value' : 'values'} and try again.
            </div>
          </div>
        )}
        {failure?.general && (
          <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
            <AlertTriangle size={14} aria-hidden />
            <div className={styles.noticeBody}>{failure.general}</div>
          </div>
        )}
        {done && done.remaining > 0 && (
          <div className={`${styles.notice} ${styles.noticeOk}`} role="status">
            <CheckCircle2 size={14} aria-hidden /> Applied. {done.remaining} newer suggestion
            {done.remaining === 1 ? '' : 's'} from this email {done.remaining === 1 ? 'is' : 'are'} still waiting.
          </div>
        )}
      </div>
    </section>
  )
}
