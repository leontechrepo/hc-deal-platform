import { useState } from 'react'
import { InlineEditText } from '../ui/InlineEditText/InlineEditText'
import { Button } from '../ui/Button/Button'
import { useCreateWorkstream, useDeleteWorkstream, usePatchWorkstream } from '../../hooks/useDealTimeline'
import { useToast } from '../Toast/Toast'
import { computeGanttRange, monthBoundaries, dateToX } from '../../utils/ganttScale'
import { TaskRow } from './TaskRow'
import { AddTaskForm } from './AddTaskForm'
import formStyles from '../shared/Form.module.css'
import type { DealTimelineWorkstream } from '../../types'
import styles from './GanttChart.module.css'

const PX_PER_DAY = 6
const DETAILS_WIDTH = 620
const MIN_TRACK_WIDTH = 500
const TRACK_PADDING_DAYS = 10

interface Props {
  dealId: string
  workstreams: DealTimelineWorkstream[]
}

export function GanttChart({ dealId, workstreams }: Props) {
  const createWorkstreamMutation = useCreateWorkstream(dealId)
  const patchWorkstream = usePatchWorkstream(dealId)
  const deleteWorkstreamMutation = useDeleteWorkstream(dealId)
  const { showToast } = useToast()
  const [addingTaskTo, setAddingTaskTo] = useState<number | null>(null)
  const [newWorkstreamName, setNewWorkstreamName] = useState('')

  const range = computeGanttRange(workstreams)
  const rangeStart = range?.start ?? new Date()
  const months = range ? monthBoundaries(range) : []
  const trackWidth = range
    ? Math.max(MIN_TRACK_WIDTH, dateToX(range.end, rangeStart, PX_PER_DAY) + TRACK_PADDING_DAYS * PX_PER_DAY)
    : MIN_TRACK_WIDTH

  async function handleAddWorkstream() {
    const name = newWorkstreamName.trim()
    if (!name) return
    try {
      await createWorkstreamMutation.mutateAsync({ name, sortOrder: workstreams.length })
      setNewWorkstreamName('')
      showToast('Workstream added')
    } catch {
      showToast('Failed to add workstream', true)
    }
  }

  async function handleDeleteWorkstream(workstreamId: number) {
    try {
      await deleteWorkstreamMutation.mutateAsync(workstreamId)
      showToast('Workstream deleted')
    } catch {
      showToast('Failed to delete workstream', true)
    }
  }

  async function handleRenameWorkstream(workstreamId: number, name: string | null) {
    await patchWorkstream.mutateAsync({ workstreamId, body: { name: name ?? '' } })
  }

  return (
    <div className={styles.wrap}>
      {range && (
        <div className={styles.row}>
          <div className={styles.spacer} style={{ width: DETAILS_WIDTH }} />
          <div className={styles.rulerTrack} style={{ width: trackWidth }}>
            {months.map(m => (
              <div key={m.toISOString()} className={styles.rulerTick} style={{ left: dateToX(m, rangeStart, PX_PER_DAY) }}>
                {m.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </div>
            ))}
          </div>
        </div>
      )}

      {workstreams.map(ws => (
        <div key={ws.id} className={styles.workstream}>
          <div className={styles.row}>
            <div className={styles.workstreamHeader} style={{ width: DETAILS_WIDTH }}>
              <div className={styles.workstreamName}>
                <InlineEditText value={ws.name} onSave={v => handleRenameWorkstream(ws.id, v)} />
              </div>
              <Button variant="ghost" size="sm" onClick={() => setAddingTaskTo(ws.id)}>+ Task</Button>
              <button className={styles.deleteBtn} onClick={() => handleDeleteWorkstream(ws.id)} title="Delete workstream">×</button>
            </div>
          </div>
          {ws.tasks.map(task => (
            <TaskRow key={task.id} dealId={dealId} task={task} rangeStart={rangeStart} pxPerDay={PX_PER_DAY} trackWidth={trackWidth} />
          ))}
          {ws.tasks.length === 0 && (
            <div className={styles.row}>
              <div className={styles.emptyTasks} style={{ width: DETAILS_WIDTH }}>No tasks yet.</div>
            </div>
          )}
        </div>
      ))}

      <div className={styles.row}>
        <div className={styles.addWorkstream} style={{ width: DETAILS_WIDTH }}>
          <input
            className={formStyles.input}
            placeholder="New workstream name…"
            value={newWorkstreamName}
            onChange={e => setNewWorkstreamName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddWorkstream()}
          />
          <Button variant="secondary" size="sm" onClick={handleAddWorkstream} disabled={!newWorkstreamName.trim()}>
            + Workstream
          </Button>
        </div>
      </div>

      {addingTaskTo !== null && (
        <AddTaskForm
          dealId={dealId}
          workstreamId={addingTaskTo}
          open={addingTaskTo !== null}
          onClose={() => setAddingTaskTo(null)}
        />
      )}
    </div>
  )
}
