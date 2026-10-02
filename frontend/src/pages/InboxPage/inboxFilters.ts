import type { InboxGroup } from '../../api/inbox'
import {
  suggestionKind,
  INFERRED_CONFIDENCE_THRESHOLD,
  STATED_CONFIDENCE_THRESHOLD,
} from '../../components/inbox/inboxCopy'

export type ConfidenceFilter = '' | 'stated' | 'inferred' | 'weak'
export type SortKey = 'date' | 'confidence'

export function groupTopConfidence(group: InboxGroup): number | null {
  return group.suggestions.reduce<number | null>(
    (best, s) => (s.confidence !== null && (best === null || s.confidence > best) ? s.confidence : best),
    null,
  )
}

export function matchesConfidenceFilter(value: number | null, filter: ConfidenceFilter): boolean {
  if (!filter) return true
  if (value === null) return false
  if (filter === 'stated') return value >= STATED_CONFIDENCE_THRESHOLD
  if (filter === 'inferred') return value >= INFERRED_CONFIDENCE_THRESHOLD && value < STATED_CONFIDENCE_THRESHOLD
  return value < INFERRED_CONFIDENCE_THRESHOLD
}

export function filterAndSortGroups(
  groups: InboxGroup[],
  {
    q,
    confidenceFilter,
    attachmentsOnly,
    sort,
  }: { q: string; confidenceFilter: ConfidenceFilter; attachmentsOnly: boolean; sort: SortKey },
): InboxGroup[] {
  const needle = q.trim().toLowerCase()
  const filtered = groups.filter((group) => {
    if (attachmentsOnly && !group.has_attachments) return false
    if (!matchesConfidenceFilter(groupTopConfidence(group), confidenceFilter)) return false
    if (!needle) return true
    const haystacks = [
      group.email_subject,
      group.email_from,
      group.email_from_name,
      group.deal_name,
      ...group.suggestions.map((s) => s.company_name),
    ]
    return haystacks.some((h) => h?.toLowerCase().includes(needle))
  })

  return [...filtered].sort((a, b) => {
    if (sort === 'confidence') {
      return (groupTopConfidence(b) ?? -1) - (groupTopConfidence(a) ?? -1)
    }
    return (b.received_at ?? '').localeCompare(a.received_at ?? '')
  })
}

export interface InboxCounts {
  emails: number
  newDeals: number
  needsAttention: number
  highConfidence: number
}

export function inboxCounts(groups: InboxGroup[]): InboxCounts {
  const all = groups.flatMap((g) => g.suggestions)
  return {
    emails: groups.length,
    newDeals: all.filter((s) => suggestionKind(s) === 'new_deal').length,
    needsAttention: all.filter((s) => s.requires_attention).length,
    highConfidence: all.filter(
      (s) => s.confidence !== null && s.confidence >= STATED_CONFIDENCE_THRESHOLD,
    ).length,
  }
}
