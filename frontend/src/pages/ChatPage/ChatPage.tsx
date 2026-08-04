import { useEffect, useRef } from 'react'
import { useChat } from '../../hooks/useChat'
import { AiStarIcon } from '../../components/shared/AiStarIcon'
import { ChatBubble } from '../../components/chat/ChatBubble'
import { ChatComposer } from '../../components/chat/ChatComposer'
import { ChatSidebar } from '../../components/chat/ChatSidebar'
import { ThinkingIndicator } from '../../components/chat/ThinkingIndicator'
import { PageShell } from '../../components/ui/PageShell/PageShell'
import styles from './ChatPage.module.css'

const SUGGESTED_QUESTIONS = [
  'Pipeline summary',
  "What's our largest active deal?",
  'Sponsor overview',
  'Portfolio status',
]

export function ChatPage() {
  const {
    sessions, activeSessionId, newChat, selectSession, deleteSession,
    messages, sendMessage, retry, isPending, canRetry,
  } = useChat()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, isPending])

  return (
    <PageShell title="Credit Co-Pilot" sub="Grounded in the unified data layer">
      <div className={styles.panel}>
        <ChatSidebar
          sessions={sessions}
          activeId={activeSessionId}
          onSelect={selectSession}
          onNew={newChat}
          onDelete={deleteSession}
        />

        <div className={styles.chatMain}>
          <div className={styles.scrollArea} ref={scrollRef}>
            {messages.length === 0 ? (
              <div className={styles.empty}>
                <AiStarIcon size={28} className={styles.emptyIcon} />
                <div className={styles.emptyHeading}>Credit Co-Pilot</div>
                <div className={styles.emptySub}>
                  Grounded in the unified data layer. Ask about deals, sponsors, portfolio, or market context.
                </div>
                <div className={styles.suggestions}>
                  {SUGGESTED_QUESTIONS.map(q => (
                    <button key={q} type="button" className={styles.pill} onClick={() => sendMessage(q)}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((m, i) => (
                  <ChatBubble key={i} message={m} />
                ))}
                {isPending && <ThinkingIndicator />}
              </>
            )}
          </div>

          <div className={styles.composerArea}>
            <ChatComposer onSend={sendMessage} disabled={isPending} />
            {canRetry && (
              <button type="button" className={styles.retryLink} onClick={retry}>
                Retry last message
              </button>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  )
}
