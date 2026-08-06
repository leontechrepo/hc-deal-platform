import { InlineEditText } from '../ui/InlineEditText/InlineEditText'
import { usePatchTask, useDeleteTask } from '../../hooks/useDealTimeline'
import { useToast } from '../Toast/Toast'
import { parseLocalDate, dateToX } from '../../utils/ganttScale'
import { MilestoneMarker } from './MilestoneMarker'
import type { PatchTaskInput } from '../../api/dealTimeline'
import formStyles from '../shared/Form.module.css'
import type { DealTimelineTask } from '../../types'
import styles from './TaskRow.module.css'

const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Complete', 'Blocked']

const STATUS_BAR_TONE: Record<string, string> = {
  'Not Started': styles.gray,
  'In Progress': styles.blue,
  'Complete': styles.green,
  'Blocked': styles.red,
}

interface Props {
  dealId: string
  task: DealTimelineTask
  rangeStart: Date
  pxPerDay: number
  trackWidth: number
}

export function TaskRow({ dealId, task, rangeStart, pxPerDay, trackWidth }: Props) {
  const patchTask = usePatchTask(dealId)
  const deleteTaskMutation = useDeleteTask(dealId)
  const { showToast } = useToast()

  async function saveField(patch: PatchTaskInput) {
    try {
      await patchTask.mutateAsync({ taskId: task.id, body: patch })
      showToast('Saved')
    } catch {
      showToast('Save failed', true)
    }
  }

  async function handleDelete() {
    try {
      await deleteTaskMutation.mutateAsync(task.id)
      showToast('Task deleted')
    } catch {
      showToast('Delete failed', true)
    }
  }

  const x = task.start_date ? dateToX(parseLocalDate(task.start_date), rangeStart, pxPerDay) : 0
  const width = !task.is_milestone && task.start_date && task.end_date
    ? Math.max(4, dateToX(parseLocalDate(task.end_date), rangeStart, pxPerDay) - x)
    : 0

  return (
    <div className={styles.row}>
      <div className={styles.details}>
        <div className={styles.name}>
          <InlineEditText value={task.name} onSave={v => saveField({ name: v ?? '' })} />
        </div>
        <div className={styles.owner}>
          <InlineEditText value={task.owner} onSave={v => saveField({ owner: v })} placeholder="Unassigned" />
        </div>
        <input
          type="date"
          className={formStyles.input}
          value={task.start_date ?? ''}
          onChange={e => {
            const value = e.target.value || null
            if (value && task.end_date && value > task.end_date) {
              showToast("Start date can't be after the end date", true)
              return
            }
            saveField({ start_date: value })
          }}
        />
        <input
          type="date"
          className={formStyles.input}
          value={task.end_date ?? ''}
          onChange={e => {
            const value = e.target.value || null
            if (value && task.start_date && value < task.start_date) {
              showToast("End date can't be before the start date", true)
              return
            }
            saveField({ end_date: value })
          }}
        />
        <select
          className={formStyles.select}
          value={task.status}
          onChange={e => saveField({ status: e.target.value })}
        >
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className={styles.deleteBtn} onClick={handleDelete} title="Delete task">×</button>
      </div>
      <div className={styles.barTrack} style={{ width: trackWidth }}>
        {task.is_milestone
          ? task.start_date && <MilestoneMarker x={x} label={task.name} />
          : task.start_date && task.end_date && (
            <div
              className={`${styles.bar} ${STATUS_BAR_TONE[task.status] ?? ''}`}
              style={{ left: x, width }}
              title={task.name}
            />
          )}
      </div>
    </div>
  )
}
