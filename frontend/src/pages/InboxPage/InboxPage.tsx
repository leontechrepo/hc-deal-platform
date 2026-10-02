import { ArrowLeft, Inbox as InboxIcon, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, EmptyState, Input, Kpi, KpiGrid } from '@leontechrepo/leon-ui'
import type { AcceptGroupResult } from '../../api/inbox'
import { EmailDetail } from '../../components/inbox/EmailDetail'
import { QueueRow } from '../../components/inbox/QueueRow'
import { UnfiledDocuments } from '../../components/inbox/UnfiledDocuments'
import { CONFIDENCE_HELP, resolveActiveGroup } from '../../components/inbox/inboxCopy'
import { TonedBadge } from '../../components/ui/TonedBadge'
import { Button } from '../../components/ui/Button/Button'
import { useToast } from '../../components/Toast/Toast'
import { useDealExtraction } from '../../context/DealExtractionContext'
import { useFeatures } from '../../hooks/useFeatures'
import { useInbox } from '../../hooks/useInbox'
import {
  filterAndSortGroups,
  inboxCounts,
  type ConfidenceFilter,
  type SortKey,
} from './inboxFilters'
import inboxStyles from '../../components/inbox/Inbox.module.css'
import styles from './InboxPage.module.css'

interface ExtractionNotice {
  key: string
  dealId: string
  companyName: string
  runId: string
}

function Skeleton() {
  return (
    <div className={styles.page} aria-busy="true" aria-label="Loading the review queue">
      <div className={styles.skeleton} style={{ height: 76 }} />
      <div className={styles.layout}>
        <div className={styles.skeleton} style={{ height: 420 }} />
        <div className={styles.skeleton} style={{ height: 420 }} />
      </div>
    </div>
  )
}

export function InboxPage() {
  const { data: groups = [], isLoading, isError, error, refetch, isFetching } = useInbox()
  const { data: features } = useFeatures()
  const { showToast } = useToast()
  const { startExtraction } = useDealExtraction()
  const [selected, setSelected] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('')
  const [attachmentsOnly, setAttachmentsOnly] = useState(false)
  const [sort, setSort] = useState<SortKey>('date')
  const [notices, setNotices] = useState<ExtractionNotice[]>([])

  const ingestionEnabled = features?.attachment_ingestion_enabled

  function handleApplied(result: AcceptGroupResult) {
    if (result.extraction_run_id && result.deal_id) {
      startExtraction(result.extraction_run_id)
      setNotices((n) => [
        ...n.filter((x) => x.runId !== result.extraction_run_id),
        {
          key: result.extraction_run_id as string,
          dealId: result.deal_id as string,
          companyName: result.company_name ?? 'the deal',
          runId: result.extraction_run_id as string,
        },
      ])
    }
    const n = result.applied.length
    showToast(
      result.created
        ? `New deal added: ${result.company_name}`
        : result.linked
          ? `Linked to ${result.company_name}`
          : n > 0
            ? `${result.company_name} updated — ${n} change${n === 1 ? '' : 's'} applied`
            : 'Nothing applied — the email was dismissed',
    )
  }

  if (isLoading) return <Skeleton />

  if (isError) {
    return (
      <Card className={styles.stateBox} role="alert">
        <EmptyState title="Couldn't load the inbox">
          {(error as Error)?.message}
          <div style={{ marginTop: 12 }}>
            <Button variant="secondary" size="sm" type="button" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? 'Retrying…' : 'Retry'}
            </Button>
          </div>
        </EmptyState>
      </Card>
    )
  }

  const counts = inboxCounts(groups)
  const suggestionTotal = groups.reduce((n, g) => n + g.suggestions.length, 0)
  const visibleGroups = filterAndSortGroups(groups, { q, confidenceFilter, attachmentsOnly, sort })
  const hasFilters = Boolean(q || confidenceFilter || attachmentsOnly)
  const active = resolveActiveGroup(groups, selected)

  const noticeBanners = notices.map((n) => (
    <div key={n.key} className={`${inboxStyles.notice} ${inboxStyles.noticeOk}`} role="status">
      <div className={inboxStyles.noticeBody}>
        Document extraction queued for <strong>{n.companyName}</strong>. Results will appear in the{' '}
        <Link to={`/deals/${n.dealId}?tab=documents&extraction=${n.runId}`}>deal&apos;s Documents tab</Link>.
      </div>
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onClick={() => setNotices((all) => all.filter((x) => x.key !== n.key))}
        aria-label={`Dismiss extraction note for ${n.companyName}`}
      >
        Dismiss
      </Button>
    </div>
  ))

  if (groups.length === 0) {
    return (
      <div className={styles.page}>
        {noticeBanners}
        <Card className={styles.stateBox}>
          <EmptyState title="Inbox zero" icon={InboxIcon}>
            Nothing is waiting for review. New suggestions appear here after the next scan of the
            monitored mailboxes.
          </EmptyState>
        </Card>
        <UnfiledDocuments />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <KpiGrid>
        <Kpi
          label="Pending emails"
          value={String(counts.emails)}
          sub={`${suggestionTotal} suggested update${suggestionTotal === 1 ? '' : 's'}`}
        />
        <Kpi label="New deals" value={String(counts.newDeals)} />
        <Kpi label="Needs attention" value={String(counts.needsAttention)} tone={counts.needsAttention > 0 ? 'red' : undefined} />
        <Kpi label="High confidence" value={String(counts.highConfidence)} sub="Stated outright in the email" />
      </KpiGrid>

      {noticeBanners}

      <div className={styles.layout}>
        <Card
          as="aside"
          aria-label="Review queue"
          className={`${styles.queue} ${active ? styles.hideNarrow : ''}`}
        >
          <div className={styles.queueHead}>
            <h2 className={styles.queueTitle}>Queue</h2>
            <span title={`${suggestionTotal} suggested updates across ${groups.length} emails`}>
              <TonedBadge tone="muted">
                {hasFilters
                  ? `${visibleGroups.length} of ${groups.length} emails`
                  : `${groups.length} email${groups.length === 1 ? '' : 's'}`}
              </TonedBadge>
            </span>
          </div>

          <div className={styles.toolbar}>
            <div style={{ position: 'relative' }}>
              <Search
                size={13}
                aria-hidden
                style={{ position: 'absolute', left: 9, top: 10, color: 'var(--muted)' }}
              />
              <Input
                type="search"
                aria-label="Search emails"
                placeholder="Search sender, subject, or company…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{ paddingLeft: 28 }}
              />
            </div>
            <div className={styles.toolbarRow}>
              <select
                className={styles.select}
                value={confidenceFilter}
                onChange={(e) => setConfidenceFilter(e.target.value as ConfidenceFilter)}
                aria-label="Filter by confidence"
              >
                <option value="">Any confidence</option>
                <option value="stated">Stated</option>
                <option value="inferred">Inferred</option>
                <option value="weak">Weak</option>
              </select>
              <select
                className={styles.select}
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Sort by"
              >
                <option value="date">Newest first</option>
                <option value="confidence">Highest confidence first</option>
              </select>
            </div>
            <div className={styles.toolbarRow}>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={attachmentsOnly}
                  onChange={(e) => setAttachmentsOnly(e.target.checked)}
                />
                Attachments only
              </label>
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setQ('')
                    setConfidenceFilter('')
                    setAttachmentsOnly(false)
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          <details className={styles.legend}>
            <summary>What do Stated / Inferred / Weak mean?</summary>
            <dl>
              {(['stated', 'inferred', 'weak'] as const).map((b) => (
                <div key={b}>
                  <dt>{CONFIDENCE_HELP[b].label}</dt>
                  <dd>{CONFIDENCE_HELP[b].meaning}</dd>
                </div>
              ))}
            </dl>
          </details>

          <div className={styles.list}>
            {visibleGroups.length === 0 ? (
              <p className={styles.empty}>No emails match these filters.</p>
            ) : (
              visibleGroups.map((group) => (
                <QueueRow
                  key={group.id}
                  group={group}
                  isActive={group.id === active?.id}
                  ingestionEnabled={ingestionEnabled}
                  onSelect={() => setSelected(group.id)}
                />
              ))
            )}
          </div>
        </Card>

        <section
          className={`${styles.detail} ${active ? '' : styles.hideNarrow}`}
          aria-label="Email detail"
        >
          {active ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                className={styles.back}
                onClick={() => setSelected(null)}
              >
                <ArrowLeft size={13} aria-hidden /> Back to queue
              </Button>
              <EmailDetail
                group={active}
                ingestionEnabled={ingestionEnabled}
                onApplied={handleApplied}
                onDismissed={(count) => showToast(`Dismissed ${count} suggestion${count === 1 ? '' : 's'}`)}
              />
            </>
          ) : (
            <Card className={styles.stateBox}>
              <EmptyState title="Select an email" icon={InboxIcon}>
                Choose an email from the queue to review its attachments and the deal changes it proposes.
              </EmptyState>
            </Card>
          )}
        </section>
      </div>

      <UnfiledDocuments selectedLogId={active ? Number(active.id) : null} />
    </div>
  )
}
