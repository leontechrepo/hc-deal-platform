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
const PICTOGRAPHIC = String.raw`\p{Extended_Pictographic}\p{Emoji_Presentation}`

/**
 * Mirrors the server's `strip_emoji` (app/domain/text.py). The backend cleans replies
 * before persisting, but sessions created before that landed still hold emoji, so
 * strip on render too rather than migrating the table.
 *
 * `\p{Extended_Pictographic}` deliberately does not match the glyphs the brand does
 * use — "→" (drill-down), "≤ ≥ ±" (comparators), dashes, or the "▌" cursor.
 */
// Modifiers as escapes, never literal characters — they are invisible in source, and a
// literal combining mark inside a character class is genuinely ambiguous
// (eslint no-misleading-character-class flags it, correctly).
const VS16 = '\\uFE0F' // variation selector-16 (emoji presentation)
const ZWJ = '\\u200D' // zero-width joiner (family/profession sequences)
const KEYCAP = '\\u20E3' // combining enclosing keycap
const SKIN = String.raw`\u{1F3FB}-\u{1F3FF}` // skin-tone modifiers

const EMOJI_RE = new RegExp(
  '(?:' +
    // keycap sequences: digit/#/* + optional VS16 + combining enclosing keycap
    `[0-9#*]${VS16}?${KEYCAP}` +
    '|' +
    // a pictographic char plus trailing VS16 / ZWJ-joined parts / skin tones
    `[${PICTOGRAPHIC}](?:${VS16}|${ZWJ}[${PICTOGRAPHIC}]|[${SKIN}])*` +
    '|' +
    // stray modifiers left on their own. An alternation, not a character class — a class
    // grouping these reads as a combined/joined sequence (no-misleading-character-class),
    // and matching them individually is exactly the intent.
    `${VS16}|${ZWJ}|${KEYCAP}` +
  ')',
  'gu',
)

function stripEmoji(text: string): string {
  if (!EMOJI_RE.test(text)) return text
  EMOJI_RE.lastIndex = 0
  return text
    .split('\n')
    .map(line => {
      const next = line.replace(EMOJI_RE, '')
      if (next === line) return line
      // Collapse the gap the removal opens ("### 📊 Overall"), but never the leading
      // indentation — that is what marks a nested list item or a code block. Measure it
      // on the ORIGINAL line, else the space that followed a line-leading emoji looks
      // like indentation.
      const indent = line.slice(0, line.length - line.trimStart().length)
      const body = next.startsWith(indent) ? next.slice(indent.length) : next
      return (indent + body.trimStart().replace(/[ \t]{2,}/g, ' ')).trimEnd()
    })
    .join('\n')
}

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
        {stripEmoji(content)}
      </ReactMarkdown>
    </div>
  )
}
