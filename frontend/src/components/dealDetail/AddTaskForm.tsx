import { useState } from 'react'
import { Modal } from '../ui/Modal/Modal'
import { Button, Field, FieldLabel } from '@leontechrepo/leon-ui'
import { Form, FormActions, FormError, FormRow, TextField } from '../ui/Form/Form'
import { useCreateTask } from '../../hooks/useDealTimeline'
import { useToast } from '../Toast/Toast'

interface Props {
  dealId: string
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
      <Form onSubmit={e => { e.preventDefault(); void handleSubmit() }}>
        <TextField label="Task Name" value={name} onChange={e => setName(e.target.value)} autoFocus />
        <TextField label="Owner" value={owner} onChange={e => setOwner(e.target.value)} />
        <FormRow>
          <TextField label="Start Date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          {!isMilestone && (
            <TextField label="End Date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          )}
        </FormRow>
        {hasReversedDates && <FormError>End date can't be before the start date.</FormError>}
        <Field orientation="horizontal">
          <input
            id="task-milestone"
            type="checkbox"
            checked={isMilestone}
            onChange={e => setIsMilestone(e.target.checked)}
          />
          <FieldLabel htmlFor="task-milestone">Milestone</FieldLabel>
        </Field>
        <FormActions>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!name.trim() || hasReversedDates || createTask.isPending}>
            Add Task
          </Button>
        </FormActions>
      </Form>
    </Modal>
  )
}
