import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { fetchExtractionRun } from '../api/extractions'
import { useToast } from '../components/Toast/Toast'
import { runErrorCopy } from '../components/documents/extractionModel'

interface DealExtractionContextValue {
  startExtraction: (runId: string) => void
}

const DealExtractionContext = createContext<DealExtractionContextValue>({
  startExtraction: () => {},
})

const POLL_MS = 4000
const TIMEOUT_MS = 5 * 60 * 1000

/**
 * Convenience layer only: shows a toast when a run started elsewhere (e.g. Inbox)
 * finishes. The source of truth is the deal's Documents tab review panel, which
 * reads from the API and survives reloads.
 */
export function DealExtractionProvider({ children }: { children: ReactNode }) {
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const startedAt = useRef<number>(0)
  const { showToast } = useToast()
  const qc = useQueryClient()

  const startExtraction = useCallback((runId: string) => {
    setActiveRunId(runId)
    startedAt.current = Date.now()
    showToast('Extraction started. Review results on the deal’s Documents tab.')
  }, [showToast])

  useEffect(() => {
    if (!activeRunId) return
    let cancelled = false

    const refresh = (dealId?: string) => {
      qc.invalidateQueries({ queryKey: dealId ? ['deals', dealId] : ['deals'] })
    }

    const tick = async () => {
      if (cancelled) return
      if (Date.now() - startedAt.current > TIMEOUT_MS) {
        showToast('Extraction is taking a while. Check the Documents tab for progress.', true)
        setActiveRunId(null)
        return
      }
      try {
        const run = await fetchExtractionRun(activeRunId)
        if (cancelled) return
        if (run.status === 'complete') {
          const open = run.candidates.filter((c) => c.needs_review).length
          showToast(
            open > 0
              ? `Extraction finished: ${open} value${open === 1 ? '' : 's'} need review on the Documents tab`
              : run.applied_field_count > 0
                ? `Extraction finished: ${run.applied_field_count} fields applied`
                : 'Extraction finished',
          )
          refresh(run.deal_id)
          setActiveRunId(null)
        } else if (run.status === 'error') {
          showToast(runErrorCopy(run.last_error) ?? 'Document extraction failed', true)
          refresh(run.deal_id)
          setActiveRunId(null)
        }
      } catch {
        // keep polling on transient errors
      }
    }

    const id = window.setInterval(() => { void tick() }, POLL_MS)
    void tick()
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [activeRunId, qc, showToast])

  return (
    <DealExtractionContext.Provider value={{ startExtraction }}>
      {children}
    </DealExtractionContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDealExtraction() {
  return useContext(DealExtractionContext)
}
