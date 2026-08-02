import { useState, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import styles from './ChatComposer.module.css'

interface Props {
  onSend: (message: string) => void
  disabled?: boolean
}

export function ChatComposer({ onSend, disabled }: Props) {
  const [value, setValue] = useState('')

  function submit() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const canSend = value.trim().length > 0 && !disabled

  return (
    <div className={styles.halo}>
      <div className={styles.composer}>
        <textarea
          className={styles.input}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about a deal, pipeline, or portfolio…"
          rows={1}
        />
        <button
          type="button"
          className={`${styles.sendBtn} ${canSend ? styles.active : ''}`}
          onClick={submit}
          disabled={!canSend}
          aria-label="Send message"
        >
          <Send size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
