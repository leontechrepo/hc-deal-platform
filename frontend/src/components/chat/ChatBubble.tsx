import type { ChatMessage } from '../../types'
import { ChatMarkdown } from './chatMarkdown'
import styles from './ChatBubble.module.css'

export function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  const bubbleClass = [
    styles.bubble,
    isUser ? styles.user : styles.assistant,
    message.error ? styles.error : '',
  ].join(' ')

  return (
    <div className={`${styles.row} ${isUser ? styles.rowUser : styles.rowAssistant}`}>
      <div className={bubbleClass}>
        {isUser ? message.content : <ChatMarkdown content={message.content} />}
      </div>
    </div>
  )
}
