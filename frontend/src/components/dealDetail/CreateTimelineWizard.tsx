import { useState } from 'react'
import { Modal } from '../ui/Modal/Modal'
import { Button } from '../ui/Button/Button'
import { useApplyTimelineTemplate, useTimelineTemplates } from '../../hooks/useDealTimeline'
import { useCurrentActor } from '../../hooks/useCurrentActor'
import { useToast } from '../Toast/Toast'
import formStyles from '../shared/Form.module.css'
import styles from './CreateTimelineWizard.module.css'

interface Props {
  dealId: number
  open: boolean
  onClose: () => void
}

export function CreateTimelineWizard({ dealId, open, onClose }: Props) {
  const { data: templates = [] } = useTimelineTemplates()
  const applyTemplate = useApplyTimelineTemplate(dealId)
  const actor = useCurrentActor()
  const { showToast } = useToast()
  const [templateName, setTemplateName] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')

  async function handleSubmit() {
    if (!templateName) return
    try {
      await applyTemplate.mutateAsync({ templateName, startDate: startDate || null, actor })
      showToast('Timeline created')
      onClose()
    } catch {
      showToast('Failed to create timeline', true)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Closing Timeline">
      <div className={formStyles.form}>
        <div className={styles.templates}>
          {templates.map(t => (
            <label key={t.key} className={styles.templateOption}>
              <input
                type="radio"
                name="template"
                value={t.key}
                checked={templateName === t.key}
                onChange={() => setTemplateName(t.key)}
              />
              <div>
                <div className={styles.templateLabel}>{t.label}</div>
                <div className={styles.templateDescription}>{t.description}</div>
              </div>
            </label>
          ))}
        </div>
        <div className={formStyles.field}>
          <label className={formStyles.label}>Start Date</label>
          <input
            type="date"
            className={formStyles.input}
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </div>
        <div className={formStyles.actions}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!templateName || applyTemplate.isPending}>
            Create Timeline
          </Button>
        </div>
      </div>
    </Modal>
  )
}
