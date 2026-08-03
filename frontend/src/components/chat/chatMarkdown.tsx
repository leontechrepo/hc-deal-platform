import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import styles from './chatMarkdown.module.css'

/**
 * Renders assistant replies as real markdown.
 *
 * Ported from Reip's `ChatMarkdown`, which moved to react-markdown + remark-gfm
 * precisely to fix this — see its commit "fix: render markdown tables in chat
 * assistant responses". `remark-gfm` is what supplies GFM tables; without it the
 * pipe rows come through as literal text, which is what this file used to do.
 *
 * (The previous hand-rolled version handled only bold, bullets and line breaks, so
 * headings, `---` rules and tables all rendered as raw source.)
 *
 * Tables get a scroll wrapper — Reip's pattern — so a wide one scrolls inside the
 * bubble instead of stretching it.
 */
export function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className={styles.markdown}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className={styles.tableWrap}>
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
