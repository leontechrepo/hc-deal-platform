import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useDealContext } from '../dealContext'
import {
  useDealDocuments,
  useDeleteDealDocument,
  usePatchDealDocument,
  useUploadDealDocument,
} from '../../../hooks/useDealDetail'
import { useStartExtraction } from '../../../hooks/useExtractions'
import { downloadDealDocument, type DealDocumentRow } from '../../../api/dealDocuments'
import { ApiError } from '../../../api/client'
import { Button } from '../../../components/ui/Button/Button'
import { EmptyState } from '../../../components/ui/EmptyState/EmptyState'
import { useToast } from '../../../components/Toast/Toast'
import { useFeatures } from '../../../hooks/useFeatures'
import formStyles from '../../../components/shared/Form.module.css'
import { ExtractionBanners } from '../../../components/documents/ExtractionBanners'
import { ExtractionReviewPanel } from '../../../components/documents/ReviewPanel'
import { DocumentsTable } from '../../../components/documents/DocumentsTable'
import { Spinner } from '../../../components/documents/CandidateCard'
import { apiErrorDetail, extractionAvailability, runDisabledReason } from '../../../components/documents/extractionModel'
import { DOCUMENT_CATEGORIES } from '../../../types'
import type { Deal } from '../../../types'
import styles from './DocumentsTab.module.css'

export function DocumentsTab({ deal: dealProp }: { deal?: Deal } = {}) {
  const ctx = useDealContext()
  const deal = dealProp ?? ctx.deal
  const qc = useQueryClient()

  const { data: features, isLoading: featuresLoading } = useFeatures()
  const { data: documents = [], isLoading, isError, refetch, isFetching } = useDealDocuments(deal.id)
  const uploadDoc = useUploadDealDocument(deal.id)
  const deleteDoc = useDeleteDealDocument(deal.id)
  const patchDoc = usePatchDealDocument(deal.id)
  const startRun = useStartExtraction(deal.id)
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [category, setCategory] = useState<string>(DOCUMENT_CATEGORIES[0])
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [highlightId, setHighlightId] = useState<number | null>(null)
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  const extractionEnabled = extractionAvailability(features).state === 'on'
  const attachmentsEnabled = features?.attachment_ingestion_enabled ?? false
  const storageOk = features?.storage_configured ?? false
  const canUpload = attachmentsEnabled && storageOk

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setDuplicateNotice(null)
    try {
      const result = await uploadDoc.mutateAsync({ file, category })
      if (result.duplicate) {
        setDuplicateNotice(`This file is already on the deal: "${result.name}". No new copy was added.`)
        focusDocument(result.id)
      } else {
        showToast(`Uploaded ${file.name}`)
      }
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 503
          ? 'Document storage is not configured'
          : 'Upload failed'
      showToast(message, true)
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDownload(doc: DealDocumentRow) {
    setDownloadingId(doc.id)
    try {
      const blob = await downloadDealDocument(doc.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      showToast('Download failed', true)
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleDelete(doc: DealDocumentRow) {
    if (!window.confirm(`Delete "${doc.name}"? This cannot be undone.`)) return
    try {
      await deleteDoc.mutateAsync(doc.id)
      setSelected((s) => {
        const next = new Set(s)
        next.delete(doc.id)
        return next
      })
      showToast('Document deleted')
    } catch {
      showToast('Failed to delete document', true)
    }
  }

  function focusDocument(id: number) {
    setHighlightId(id)
    window.setTimeout(() => {
      const el = document.getElementById(`document-row-${id}`)
      el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
      el?.focus()
    }, 50)
  }

  function toggle(id: number) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedCount = documents.filter((d) => selected.has(d.id)).length
  const disabledReason = runDisabledReason(features, selectedCount)

  function handleRun() {
    setRunError(null)
    startRun.mutate(
      documents.filter((d) => selected.has(d.id)).map((d) => d.id),
      {
        onSuccess: () => {
          setSelected(new Set())
          showToast('Extraction started. Progress is tracked in the review panel.')
        },
        onError: (err) => setRunError(apiErrorDetail(err) ?? 'Could not start extraction.'),
      },
    )
  }

  return (
    <div className={styles.tab}>
      <ExtractionBanners features={features} loading={featuresLoading} />

      {/* Always mounted: historical candidates and runs stay visible even when extraction is off. */}
      <ExtractionReviewPanel
        dealId={deal.id}
        deal={deal}
        documents={documents}
        onViewDocument={focusDocument}
      />

      {duplicateNotice && (
        <div className={styles.notice} role="status" data-testid="duplicate-notice">
          <span>{duplicateNotice}</span>
          <Button variant="ghost" size="sm" onClick={() => setDuplicateNotice(null)} aria-label="Dismiss notice">
            Dismiss
          </Button>
        </div>
      )}

      <div className={styles.uploadRow}>
        {canUpload ? (
          <>
            <select
              className={formStyles.select}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Document category"
            >
              {DOCUMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              ref={fileInputRef}
              type="file"
              className={styles.fileInput}
              onChange={handleFileSelected}
              disabled={uploadDoc.isPending}
              aria-label="Choose file to upload"
            />
            <Button
              variant="gold"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadDoc.isPending}
            >
              {uploadDoc.isPending ? 'Uploading…' : 'Upload Document'}
            </Button>
          </>
        ) : (
          <p className="field-sub">
            {!features
              ? 'Loading capabilities…'
              : !attachmentsEnabled
                ? 'Attachment ingestion is disabled — uploads are unavailable.'
                : 'Document storage is not configured — uploads are unavailable.'}
          </p>
        )}
        <span className={styles.spacer} />
        <div className={styles.runControl}>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRun}
            disabled={disabledReason !== null || startRun.isPending}
            aria-describedby="run-extraction-hint"
          >
            {startRun.isPending ? (
              <Spinner label="Starting" />
            ) : (
              `Run extraction${selectedCount ? ` (${selectedCount})` : ''}`
            )}
          </Button>
          <span id="run-extraction-hint" className={styles.hint}>
            {disabledReason ?? 'Analyse the selected documents for deal terms.'}
          </span>
          {runError && (
            <span className={styles.hint} role="alert" style={{ color: 'var(--red)' }}>
              {runError}
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className={styles.skeleton} aria-busy="true" aria-label="Loading documents">
          <span /><span /><span />
        </div>
      ) : isError ? (
        <div className={styles.errorBox} role="alert">
          <span>Failed to load documents.</span>
          <Button variant="secondary" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Retrying…' : 'Retry'}
          </Button>
        </div>
      ) : documents.length === 0 ? (
        <EmptyState
          title="No documents yet"
          description={
            canUpload
              ? 'Upload a document to attach it to this deal.'
              : 'Documents will appear here when ingestion is enabled and files are filed.'
          }
        />
      ) : (
        <DocumentsTable
          documents={documents}
          selected={selected}
          onToggle={toggle}
          onToggleAll={(checked) => setSelected(checked ? new Set(documents.map((d) => d.id)) : new Set())}
          highlightId={highlightId}
          extractionEnabled={extractionEnabled}
          patchPending={patchDoc.isPending}
          deletePending={deleteDoc.isPending}
          downloadingId={downloadingId}
          onDownload={handleDownload}
          onDelete={handleDelete}
          onFlagReview={(d, checked) =>
            patchDoc.mutate(
              { documentId: d.id, body: { human_review_required: checked } },
              { onSuccess: () => qc.invalidateQueries({ queryKey: ['deals', deal.id, 'extractions'] }) },
            )
          }
        />
      )}
    </div>
  )
}
