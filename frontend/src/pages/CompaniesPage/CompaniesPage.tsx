import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCompanies, useCreateCompany, useUpdateCompany } from '../../hooks/useCompanies'
import { CompanyFormModal } from '../../components/companies/CompanyFormModal'
import { Building, Plus } from 'lucide-react'
import { Button, EmptyState } from '@leontechrepo/leon-ui'
import { SearchBox } from '../../components/ui/SearchBox'
import { PageError, PageLoading } from '../../components/ui/PageState'
import { PageActions } from '../../components/shell/PageActions'
import { DataTable, type Column } from '../../components/ui/DataTable/DataTable'
import { useToast } from '../../components/Toast/Toast'
import type { Company, CompanyInput } from '../../types'
import styles from './CompaniesPage.module.css'

export function CompaniesPage() {
  const { data: companies = [], isLoading, isError, refetch } = useCompanies()
  const createCompany = useCreateCompany()
  const updateCompany = useUpdateCompany()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Company | null>(null)

  // Deep link support (e.g. "View in Companies" from a deal's Overview tab):
  // ?id=<company_id> opens that company's edit modal directly, once, as soon
  // as the list has loaded.
  const linkedId = searchParams.get('id')
  const openedLinkedId = useRef<string | null>(null)
  useEffect(() => {
    if (!linkedId || linkedId === openedLinkedId.current) return
    const match = companies.find(c => c.company_id === linkedId)
    if (match) {
      openedLinkedId.current = linkedId
      openEdit(match)
    }
  }, [linkedId, companies])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return companies
    return companies.filter(c =>
      c.company_name.toLowerCase().includes(q) || (c.sector ?? '').toLowerCase().includes(q)
    )
  }, [companies, search])

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(company: Company) {
    setEditing(company)
    setModalOpen(true)
  }

  async function handleSubmit(body: Partial<CompanyInput>) {
    if (editing) {
      await updateCompany.mutateAsync({ companyId: editing.company_id, body })
      showToast('Company updated')
    } else {
      await createCompany.mutateAsync(body)
      showToast('Company created')
    }
  }

  const columns: Column<Company>[] = [
    { key: 'company_name', header: 'Company', render: c => c.company_name },
    { key: 'sector', header: 'Sector', render: c => c.sector || '—' },
    { key: 'subsector', header: 'Subsector', render: c => c.subsector || '—' },
    { key: 'hq_location', header: 'HQ Location', render: c => c.hq_location || '—' },
    { key: 'state', header: 'State', render: c => c.state || '—' },
    {
      key: 'actions',
      header: '',
      render: c => <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Edit</Button>,
    },
  ]

  if (isLoading) return <PageLoading label="Loading companies…" />
  if (isError) return <PageError title="Couldn't load companies" onRetry={() => void refetch()} />

  const newCompany = (
    <Button size="sm" onClick={openCreate}>
      <Plus size={14} strokeWidth={2.05} />
      New Company
    </Button>
  )

  return (
    <>
      <PageActions>{newCompany}</PageActions>
      <div className={styles.toolbar}>
        <SearchBox value={search} onChange={setSearch} placeholder="Search companies…" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Building} title={companies.length === 0 ? 'No companies yet' : 'No companies match'} action={companies.length === 0 ? newCompany : undefined}>
          {companies.length === 0
            ? 'Add a company record, or create a deal to have one added automatically.'
            : 'Try a different search.'}
        </EmptyState>
      ) : (
        <DataTable columns={columns} rows={filtered} rowKey={c => c.company_id} />
      )}

      <CompanyFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          if (linkedId) setSearchParams({}, { replace: true })
        }}
        initial={editing}
        onSubmit={handleSubmit}
      />
    </>
  )
}
