import { useOutletContext } from 'react-router-dom'
import { useRef, useState } from 'react'
import { useDealDocuments, useDeleteDealDocument, useUploadDealDocument } from '../../../hooks/useDealDetail'
import { downloadDealDocument } from '../../../api/dealDocuments'
import { ApiError } from '../../../api/client'
import { Button } from '../../../components/ui/Button/Button'
import { EmptyState } from '../../../components/ui/EmptyState/EmptyState'
import { Tag } from '../../../components/ui/Tag/Tag'
import { DataTable, type Column } from '../../../components/ui/DataTable/DataTable'
import { useToast } from '../../../components/Toast/Toast'
import formStyles from '../../../components/shared/Form.module.css'
import { DOCUMENT_CATEGORIES } from '../../../types'
import type { Deal, DealDocument } from '../../../types'
import styles from './DocumentsTab.module.css'

function fmtSize(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export function DocumentsTab() {
  const { deal } = useOutletContext<{ deal: Deal }>()
  const { data: documents = [], isLoading, isError } = useDealDocuments(deal.id)
  const uploadDoc = useUploadDealDocument(deal.id)
  const deleteDoc = useDeleteDealDocument(deal.id)
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [category, setCategory] = useState<string>(DOCUMENT_CATEGORIES[0])
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await uploadDoc.mutateAsync({ file, category })
      showToast(`Uploaded ${file.name}`)
    } catch (err) {
      const message = err instanceof ApiError && err.status === 503
        ? 'Document storage is not configured'
        : 'Upload failed'
      showToast(message, true)
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDownload(doc: DealDocument) {
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

  async function handleDelete(doc: DealDocument) {
    if (!window.confirm(`Delete "${doc.name}"? This cannot be undone.`)) return
    try {
      await deleteDoc.mutateAsync(doc.id)
      showToast('Document deleted')
    } catch {
      showToast('Failed to delete document', true)
    }
  }

  if (isLoading) return <div className={styles.state}>Loading documents…</div>
  if (isError) return <div className={styles.state}>Failed to load documents.</div>

  const columns: Column<DealDocument>[] = [
    { key: 'name', header: 'Name', render: d => d.name },
    { key: 'category', header: 'Category', render: d => (d.category ? <Tag>{d.category}</Tag> : '—') },
    { key: 'size', header: 'Size', render: d => fmtSize(d.size_bytes) },
    { key: 'uploaded_by', header: 'Uploaded By', render: d => d.uploaded_by ?? '—' },
    { key: 'created_at', header: 'Date', render: d => fmtDate(d.created_at) },
    {
      key: 'actions',
      header: '',
      render: d => (
        <div className={styles.actions}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleDownload(d)}
            disabled={downloadingId === d.id}
          >
            {downloadingId === d.id ? 'Downloading…' : 'Download'}
          </Button>
          <Button variant="danger" size="sm" onClick={() => handleDelete(d)} disabled={deleteDoc.isPending}>
            Delete
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className={styles.tab}>
      <div className={styles.uploadRow}>
        <select
          className={formStyles.select}
          value={category}
          onChange={e => setCategory(e.target.value)}
        >
          {DOCUMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          ref={fileInputRef}
          type="file"
          className={styles.fileInput}
          onChange={handleFileSelected}
          disabled={uploadDoc.isPending}
        />
        <Button
          variant="gold"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadDoc.isPending}
        >
          {uploadDoc.isPending ? 'Uploading…' : 'Upload Document'}
        </Button>
      </div>

      {documents.length === 0 ? (
        <EmptyState title="No documents yet" description="Upload a document to attach it to this deal." />
      ) : (
        <DataTable columns={columns} rows={documents} rowKey={d => d.id} emptyMessage="No documents yet." />
      )}
    </div>
  )
}
