import { Plus, Trash2 } from 'lucide-react'
import type { ChatSessionSummary } from '../../types'
import { AiStarIcon } from '../shared/AiStarIcon'
import styles from './ChatSidebar.module.css'

interface Props {
  sessions: ChatSessionSummary[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
}

function formatSessionDate(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)

  if (dayDiff === 0) return 'Today'
  if (dayDiff === 1) return 'Yesterday'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ChatSidebar({ sessions, activeId, onSelect, onNew, onDelete }: Props) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <AiStarIcon size={15} className={styles.headerIcon} />
        <span className={styles.title}>Chats</span>
        <button type="button" className={styles.newBtn} title="New chat" onClick={onNew}>
          <Plus size={14} />
        </button>
      </div>

      <div className={styles.list}>
        {sessions.length === 0 ? (
          <div className={styles.empty}>No conversations yet</div>
        ) : (
          sessions.map(session => (
            <div
              key={session.id}
              className={`${styles.item} ${session.id === activeId ? styles.active : ''}`}
              onClick={() => onSelect(session.id)}
              role="button"
              tabIndex={0}
            >
              <div className={styles.info}>
                <div className={styles.itemTitle}>{session.title}</div>
                <div className={styles.itemDate}>{formatSessionDate(session.updated_at)}</div>
              </div>
              <button
                type="button"
                className={styles.deleteBtn}
                aria-label="Delete conversation"
                onClick={e => { e.stopPropagation(); onDelete(session.id) }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
