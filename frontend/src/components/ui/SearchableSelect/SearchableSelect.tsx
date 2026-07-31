import { useEffect, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import styles from './SearchableSelect.module.css'

export interface SearchableSelectOption {
  id: string
  label: string
}

interface Props {
  options: SearchableSelectOption[]
  value: string | null
  onChange: (id: string | null) => void
  noneLabel?: string
  placeholder?: string
}

export function SearchableSelect({ options, value, onChange, noneLabel = 'None', placeholder = 'Search…' }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find(o => o.id === value) ?? null
  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function openList() {
    setOpen(true)
    setHighlighted(0)
  }

  function selectOption(id: string | null) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault()
        openList()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = filtered[highlighted]
      if (opt) selectOption(opt.id)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setQuery('')
      inputRef.current?.blur()
    }
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <div
        className={styles.trigger}
        onMouseDown={() => {
          openList()
          inputRef.current?.focus()
        }}
      >
        <input
          ref={inputRef}
          className={styles.input}
          value={open ? query : (selected?.label ?? '')}
          placeholder={selected ? undefined : placeholder}
          onFocus={openList}
          onChange={e => {
            setQuery(e.target.value)
            setHighlighted(0)
            if (!open) setOpen(true)
          }}
          onKeyDown={handleKeyDown}
        />
        {selected && !open && (
          <button
            type="button"
            className={styles.clearBtn}
            onMouseDown={e => {
              e.preventDefault()
              e.stopPropagation()
              selectOption(null)
            }}
            aria-label="Clear selection"
          >
            <X size={14} />
          </button>
        )}
        <ChevronDown size={16} className={styles.chevron} />
      </div>
      {open && (
        <ul className={styles.list} role="listbox">
          <li
            className={`${styles.option} ${styles.noneOption}`}
            onMouseDown={e => {
              e.preventDefault()
              selectOption(null)
            }}
          >
            {noneLabel}
          </li>
          {filtered.length === 0 ? (
            <li className={styles.empty}>No results</li>
          ) : (
            filtered.map((opt, i) => (
              <li
                key={opt.id}
                className={`${styles.option} ${i === highlighted ? styles.highlighted : ''}`}
                onMouseDown={e => {
                  e.preventDefault()
                  selectOption(opt.id)
                }}
                onMouseEnter={() => setHighlighted(i)}
                role="option"
                aria-selected={opt.id === value}
              >
                {opt.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
