import { useState } from 'react'
import { useDeals } from '../../hooks/useDeals'
import { useAssignInboxItem } from '../../hooks/useInbox'
import { useToast } from '../Toast/Toast'
import { Button } from '../ui/Button/Button'
import { SearchableSelect } from '../ui/SearchableSelect/SearchableSelect'
import styles from './AssignToDealControl.module.css'

interface Props {
  suggestionId: number
  companyName: string
}

export function AssignToDealControl({ suggestionId, companyName }: Props) {
  const { data: deals = [] } = useDeals()
  const assign = useAssignInboxItem()
  const { showToast } = useToast()

  const [expanded, setExpanded] = useState(false)
  const [dealId, setDealId] = useState<string | null>(null)

  if (!expanded) {
    return (
      <button className={styles.toggleLink} onClick={() => setExpanded(true)}>
        Link to existing deal instead
      </button>
    )
  }

  async function handleAssign() {
    if (!dealId) return
    try {
      await assign.mutateAsync({ id: suggestionId, dealId: Number(dealId) })
      showToast(`Linked ${companyName} to existing deal`)
    } catch {
      showToast('Failed to link deal', true)
    }
  }

  return (
    <div className={styles.control}>
      <div className={styles.selectWrap}>
        <SearchableSelect
          options={deals.map(d => ({ id: String(d.id), label: d.company_name }))}
          value={dealId}
          onChange={setDealId}
          noneLabel="Select existing deal…"
          placeholder="Search deals…"
        />
      </div>
      <Button variant="secondary" onClick={handleAssign} disabled={!dealId || assign.isPending}>
        {assign.isPending ? 'Linking…' : 'Link to this deal'}
      </Button>
      <button className={styles.toggleLink} onClick={() => setExpanded(false)}>Cancel</button>
    </div>
  )
}
