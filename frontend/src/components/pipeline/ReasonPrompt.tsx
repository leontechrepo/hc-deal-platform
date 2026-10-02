import { AlertTriangle } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button, Card } from '@leontechrepo/leon-ui'

import { TextareaInput } from '../ui/Form/Form'
import styles from './SkipReasonPrompt.module.css'

/** Inline "give me a reason" card: a title, an explanation and a required note. */
export function ReasonPrompt({
  title,
  description,
  placeholder = 'Why?',
  confirmLabel = 'Confirm',
  busy,
  onCancel,
  onConfirm,
}: {
  title: ReactNode
  description: ReactNode
  placeholder?: string
  confirmLabel?: string
  busy?: boolean
  onCancel: () => void
  onConfirm: (reasoning: string) => void
}) {
  const [reasoning, setReasoning] = useState('')

  return (
    <Card className={styles.prompt} role="alert">
      <div className={styles.head}>
        <AlertTriangle size={15} strokeWidth={2.05} />
        <strong>{title}</strong>
      </div>
      <p className={styles.body}>{description}</p>
      <TextareaInput
        autoFocus
        rows={3}
        placeholder={placeholder}
        aria-label="Reason"
        value={reasoning}
        onChange={(e) => setReasoning(e.target.value)}
      />
      <div className={styles.actions}>
        <Button variant="ghost" size="sm" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" type="button" disabled={!reasoning.trim() || busy} onClick={() => onConfirm(reasoning.trim())}>
          {busy ? 'Saving…' : confirmLabel}
        </Button>
      </div>
    </Card>
  )
}
