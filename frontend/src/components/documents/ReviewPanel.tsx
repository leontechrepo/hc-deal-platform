import { useState } from 'react'
import { Card, CardHeader, CardTitle, Kpi, KpiGrid } from '@leontechrepo/leon-ui'
import type { DealDocumentRow } from '../../api/dealDocuments'
import { useDealExtractions } from '../../hooks/useExtractions'
import { Button } from '../ui/Button/Button'
import { CandidateCard } from './CandidateCard'
import { RunHistory } from './RunHistory'
import {
  fieldLabel,
  groupByField,
  isRunActive,
  reviewCounts,
  runStatusLabel,
} from './extractionModel'
import styles from './Review.module.css'

interface Props {
  dealId: string
  /** The deal record, used to show the live current value for each field. */
  deal?: object
  documents: DealDocumentRow[]
  onViewDocument?: (documentId: number) => void
}

export function ExtractionReviewPanel({ dealId, deal, documents, onViewDocument }: Props) {
  const { data, isLoading, isError, refetch, isFetching } = useDealExtractions(dealId)
  const [userOpen, setUserOpen] = useState<boolean | null>(null)

  const candidates = data?.candidates ?? []
  const runs = data?.runs ?? []
  const counts = reviewCounts(candidates, runs)
  const groups = groupByField(candidates)
  const activeRuns = runs.filter(isRunActive)
  const open = userOpen ?? (counts.needsReview > 0 || candidates.length === 0)
  const bodyId = `extraction-panel-body-${dealId}`

  const live = (field: string): unknown =>
    deal && field in deal ? (deal as Record<string, unknown>)[field] ?? null : undefined

  const resolved = groups.filter((g) => g.resolved.length > 0)
  const resolvedCount = resolved.reduce((n, g) => n + g.resolved.length, 0)
  const withOpen = groups.filter((g) => g.open.length > 0)

  return (
    <Card as="section" aria-label="Extraction review" className={styles.panel}>
      <CardHeader>
        <CardTitle>
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setUserOpen(!open)}
          >
            <span aria-hidden="true">{open ? '▾' : '▸'}</span> Document review
            {counts.needsReview > 0 && (
              <span className={styles.pill} aria-label={`${counts.needsReview} need review`}>
                {counts.needsReview}
              </span>
            )}
          </button>
        </CardTitle>
      </CardHeader>

      <div id={bodyId} hidden={!open}>
        {isLoading ? (
          <div className={styles.skeleton} aria-busy="true" aria-label="Loading extraction results">
            <span /><span /><span />
          </div>
        ) : isError ? (
          <div className={styles.errorBox} role="alert">
            <p>Could not load extraction results.</p>
            <Button variant="secondary" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? 'Retrying…' : 'Retry'}
            </Button>
          </div>
        ) : (
          <>
            {activeRuns.length > 0 && (
              <div className={styles.progress} role="status" data-testid="extraction-progress">
                <span className={styles.spinner} aria-hidden="true" />
                <span>
                  Extraction in progress ({runStatusLabel(activeRuns[0]).toLowerCase()}
                  {activeRuns.length > 1 ? `, ${activeRuns.length} runs` : ''}). Results appear here automatically.
                </span>
              </div>
            )}

            <KpiGrid>
              <Kpi label="Needs review" value={counts.needsReview} tone={counts.needsReview ? 'red' : 'navy'} />
              <Kpi label="Applied" value={counts.applied} tone="green" />
              <Kpi label="Conflicts" value={counts.conflicts} tone={counts.conflicts ? 'red' : 'navy'} />
              <Kpi label="Failed runs" value={counts.failed} tone={counts.failed ? 'red' : 'navy'} />
            </KpiGrid>

            {candidates.length === 0 ? (
              <p className={styles.empty} data-testid="no-candidates">
                No extracted values yet. Results from documents on this deal will appear here for review.
              </p>
            ) : (
              <>
                {withOpen.length === 0 && (
                  <p className={styles.empty}>Nothing needs review right now.</p>
                )}
                {withOpen.map((g) => (
                  <section key={g.field} className={styles.group} aria-label={`${g.label} review`}>
                    <h4 className={styles.groupTitle}>
                      {g.label}
                      {g.hasConflict && <span className={styles.conflictTag}>Documents disagree</span>}
                    </h4>
                    <div className={g.open.length > 1 ? styles.compare : styles.single}>
                      {g.open.map((c) => (
                        <CandidateCard
                          key={c.id}
                          candidate={c}
                          dealId={dealId}
                          currentValue={live(c.field)}
                          onViewDocument={onViewDocument}
                        />
                      ))}
                    </div>
                  </section>
                ))}

                {resolvedCount > 0 && (
                  <details className={styles.disclosure}>
                    <summary>Resolved ({resolvedCount})</summary>
                    {resolved.map((g) => (
                      <section key={g.field} className={styles.group} aria-label={`${g.label} history`}>
                        <h4 className={styles.groupTitle}>{fieldLabel(g.field)}</h4>
                        <div className={styles.single}>
                          {g.resolved.map((c) => (
                            <CandidateCard
                              key={c.id}
                              candidate={c}
                              dealId={dealId}
                              onViewDocument={onViewDocument}
                            />
                          ))}
                        </div>
                      </section>
                    ))}
                  </details>
                )}
              </>
            )}

            <RunHistory runs={runs} documents={documents} />
          </>
        )}
      </div>
    </Card>
  )
}
