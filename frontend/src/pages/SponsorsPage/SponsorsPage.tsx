import { useMemo, useState } from 'react'
import { useCreateSponsor, useDeleteSponsor, useSponsors, useUpdateSponsor } from '../../hooks/useSponsors'
import { SponsorCard } from '../../components/sponsors/SponsorCard'
import { SponsorFormModal } from '../../components/sponsors/SponsorFormModal'
import { Button } from '../../components/ui/Button/Button'
import { EmptyState } from '../../components/ui/EmptyState/EmptyState'
import { KPIGrid } from '../../components/ui/KPIGrid/KPIGrid'
import { PageHeader } from '../../components/ui/PageHeader/PageHeader'
import { useToast } from '../../components/Toast/Toast'
import type { Sponsor, SponsorInput } from '../../types'
import styles from './SponsorsPage.module.css'

export function SponsorsPage() {
  const { data: sponsors = [], isLoading, isError } = useSponsors()
  const createSponsor = useCreateSponsor()
  const updateSponsor = useUpdateSponsor()
  const deleteSponsor = useDeleteSponsor()
  const { showToast } = useToast()

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Sponsor | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sponsors
    return sponsors.filter(s =>
      s.name.toLowerCase().includes(q) || (s.focus ?? '').toLowerCase().includes(q)
    )
  }, [sponsors, search])

  const kpiItems = useMemo(() => [
    { label: 'Total Sponsors', value: sponsors.length },
    { label: 'Total AUM', value: `$${sponsors.reduce((sum, s) => sum + (s.aum_m ?? 0), 0).toFixed(0)}M` },
    { label: 'Active Deals', value: sponsors.reduce((sum, s) => sum + s.active_deal_count, 0) },
    { label: 'Total Exposure', value: `$${sponsors.reduce((sum, s) => sum + s.total_exposure_m, 0).toFixed(1)}M` },
  ], [sponsors])

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(sponsor: Sponsor) {
    setEditing(sponsor)
    setModalOpen(true)
  }

  async function handleSubmit(body: Partial<SponsorInput>) {
    if (editing) {
      await updateSponsor.mutateAsync({ id: editing.id, body })
      showToast('Sponsor updated')
    } else {
      await createSponsor.mutateAsync(body)
      showToast('Sponsor created')
    }
  }

  async function handleDelete(sponsor: Sponsor) {
    if (!window.confirm(`Delete sponsor "${sponsor.name}"? This cannot be undone.`)) return
    try {
      await deleteSponsor.mutateAsync(sponsor.id)
      showToast('Sponsor deleted')
    } catch {
      showToast('Delete failed', true)
    }
  }

  if (isLoading) return <div className={styles.state}>Loading sponsors…</div>
  if (isError) return <div className={styles.state}>Failed to load sponsors.</div>

  return (
    <div className={styles.page}>
      <PageHeader title="Sponsors" />

      <KPIGrid items={kpiItems} />

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder="Search sponsors…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Button variant="primary" onClick={openCreate}>New Sponsor</Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No sponsors yet"
          description="Add your first sponsor relationship."
          action={<Button variant="primary" onClick={openCreate}>New Sponsor</Button>}
        />
      ) : (
        <div className={styles.grid}>
          {filtered.map(sponsor => (
            <SponsorCard
              key={sponsor.id}
              sponsor={sponsor}
              onEdit={() => openEdit(sponsor)}
              onDelete={() => handleDelete(sponsor)}
              onUpdateField={(field, value) =>
                updateSponsor.mutateAsync({ id: sponsor.id, body: { [field]: value } })
              }
            />
          ))}
        </div>
      )}

      <SponsorFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={editing}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
