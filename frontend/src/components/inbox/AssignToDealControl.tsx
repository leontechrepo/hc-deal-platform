import { useState } from 'react'
import { useDeals } from '../../hooks/useDeals'
import { useAssignInboxItem } from '../../hooks/useInbox'
import { useToast } from '../Toast/Toast'
import { Button } from '../ui/Button/Button'
import formStyles from '../shared/Form.module.css'
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
  const [dealId, setDealId] = useState<string>('')

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
      <select className={formStyles.select} value={dealId} onChange={e => setDealId(e.target.value)}>
        <option value="">Select existing deal…</option>
        {deals.map(d => (
          <option key={d.id} value={d.id}>{d.company_name}</option>
        ))}
      </select>
      <Button variant="secondary" onClick={handleAssign} disabled={!dealId || assign.isPending}>
        {assign.isPending ? 'Linking…' : 'Link to this deal'}
      </Button>
      <button className={styles.toggleLink} onClick={() => setExpanded(false)}>Cancel</button>
    </div>
  )
}
