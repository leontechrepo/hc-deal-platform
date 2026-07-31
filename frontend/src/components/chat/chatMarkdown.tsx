import type { ReactNode } from 'react'

function parseInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(\*\*.+?\*\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>
  })
}

// Deliberately minimal — mirrors the Reip design system's own hand-rolled
// ChatMarkdown (bold + bullet lists + line breaks only, no headings/tables/
// code fences), not a full markdown library.
export function renderChatMarkdown(content: string): ReactNode {
  const blocks = content.trim().split(/\n{2,}/)
  return blocks.map((block, bi) => {
    const lines = block.split('\n').filter(l => l.length > 0)
    const isList = lines.length > 0 && lines.every(l => /^[-*]\s+/.test(l.trim()))

    if (isList) {
      return (
        <ul key={bi}>
          {lines.map((line, li) => (
            <li key={li}>{parseInline(line.trim().replace(/^[-*]\s+/, ''), `${bi}-${li}`)}</li>
          ))}
        </ul>
      )
    }

    return (
      <p key={bi}>
        {lines.map((line, li) => (
          <span key={li}>
            {parseInline(line, `${bi}-${li}`)}
            {li < lines.length - 1 && <br />}
          </span>
        ))}
      </p>
    )
  })
}
