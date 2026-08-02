import { useState } from 'react'
import { Modal } from '../ui/Modal/Modal'
import { Button } from '../ui/Button/Button'
import { useCreateTask } from '../../hooks/useDealTimeline'
import { useToast } from '../Toast/Toast'
import formStyles from '../shared/Form.module.css'
import styles from './AddTaskForm.module.css'

interface Props {
  dealId: number
  workstreamId: number
  open: boolean
  onClose: () => void
}

export function AddTaskForm({ dealId, workstreamId, open, onClose }: Props) {
  const createTask = useCreateTask(dealId)
  const { showToast } = useToast()
  const [name, setName] = useState('')
  const [owner, setOwner] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isMilestone, setIsMilestone] = useState(false)

  function reset() {
    setName('')
    setOwner('')
    setStartDate('')
    setEndDate('')
    setIsMilestone(false)
  }

  const hasReversedDates = !isMilestone && !!startDate && !!endDate && endDate < startDate

  async function handleSubmit() {
    if (!name.trim() || hasReversedDates) return
    try {
      await createTask.mutateAsync({
        workstreamId,
        body: {
          name: name.trim(),
          owner: owner.trim() || null,
          start_date: startDate || null,
          end_date: (isMilestone ? startDate : endDate) || null,
          is_milestone: isMilestone,
        },
      })
      showToast('Task added')
      reset()
      onClose()
    } catch {
      showToast('Failed to add task', true)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Task">
      <div className={formStyles.form}>
        <div className={formStyles.field}>
          <label className={formStyles.label}>Task Name</label>
          <input className={formStyles.input} value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div className={formStyles.field}>
          <label className={formStyles.label}>Owner</label>
          <input className={formStyles.input} value={owner} onChange={e => setOwner(e.target.value)} />
        </div>
        <div className={formStyles.row}>
          <div className={formStyles.field}>
            <label className={formStyles.label}>Start Date</label>
            <input type="date" className={formStyles.input} value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          {!isMilestone && (
            <div className={formStyles.field}>
              <label className={formStyles.label}>End Date</label>
              <input type="date" className={formStyles.input} value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          )}
        </div>
        {hasReversedDates && (
          <div className={formStyles.error}>End date can't be before the start date.</div>
        )}
        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={isMilestone} onChange={e => setIsMilestone(e.target.checked)} />
          <span className={formStyles.label}>Milestone</span>
        </label>
        <div className={formStyles.actions}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!name.trim() || hasReversedDates || createTask.isPending}>
            Add Task
          </Button>
        </div>
      </div>
    </Modal>
  )
}
