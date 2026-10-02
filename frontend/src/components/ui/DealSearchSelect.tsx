import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Input } from '@leontechrepo/leon-ui'
import { useDeals } from '../../hooks/useDeals'
import type { Deal } from '../../types'
import styles from './DealSearchSelect.module.css'

/**
 * Search-as-you-type deal picker, portaled like Modal — the detail pane may sit
 * inside an `overflow: hidden` ancestor, so an in-flow panel would clip.
 * Filters the cached deal list client-side (HC has no deal search endpoint).
 */
export function DealSearchSelect({
  value,
  initialLabel,
  onChange,
  placeholder = 'Search deals…',
  disabled,
  ariaLabel = 'Search deals',
}: {
  value: string | null
  initialLabel?: string | null
  onChange: (dealId: string | null, deal?: Deal) => void
  placeholder?: string
  disabled?: boolean
  ariaLabel?: string
}) {
  const { data: deals = [], isFetching } = useDeals()
  const [query, setQuery] = useState(initialLabel ?? '')
  const [selectedLabel, setSelectedLabel] = useState(initialLabel ?? '')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 250)
    return () => clearTimeout(timer)
  }, [query])

  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    if (value === null && selectedLabel !== '') {
      setSelectedLabel('')
      setQuery('')
    }
  }

  const options = useMemo(() => {
    if (!debouncedQuery) return []
    return deals
      .filter((d) => d.company_name.toLowerCase().includes(debouncedQuery))
      .slice(0, 8)
  }, [deals, debouncedQuery])

  const optionsKey = `${debouncedQuery}:${options.length}`
  const [prevOptionsKey, setPrevOptionsKey] = useState(optionsKey)
  if (optionsKey !== prevOptionsKey) {
    setPrevOptionsKey(optionsKey)
    setHighlighted(0)
  }

  useEffect(() => {
    if (!open) return
    const updateRect = () => setRect(wrapperRef.current?.getBoundingClientRect() ?? null)
    updateRect()
    window.addEventListener('scroll', updateRect, true)
    window.addEventListener('resize', updateRect)
    return () => {
      window.removeEventListener('scroll', updateRect, true)
      window.removeEventListener('resize', updateRect)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (wrapperRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      close()
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close is stable enough for dismiss
  }, [open])

  function commit(deal: Deal) {
    setQuery(deal.company_name)
    setSelectedLabel(deal.company_name)
    onChange(String(deal.id), deal)
    setOpen(false)
  }

  function close() {
    setOpen(false)
    setQuery(selectedLabel)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlighted((i) => Math.min(i + 1, options.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const picked = options[highlighted]
      if (picked) commit(picked)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    }
  }

  return (
    <div className={styles.wrap} ref={wrapperRef}>
      <Input
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const next = e.target.value
          setQuery(next)
          setOpen(true)
          if (next !== selectedLabel) {
            setSelectedLabel('')
            onChange(null)
          }
        }}
        onKeyDown={onKeyDown}
      />
      {open &&
        rect &&
        createPortal(
          <div
            className={styles.panel}
            ref={panelRef}
            style={{ top: rect.bottom + 4, left: rect.left, width: rect.width }}
          >
            {debouncedQuery.length === 0 ? (
              <div className={styles.empty}>Type to search deals…</div>
            ) : isFetching && deals.length === 0 ? (
              <div className={styles.empty}>Searching…</div>
            ) : options.length === 0 ? (
              <div className={styles.empty}>No deals match</div>
            ) : (
              options.map((deal, index) => (
                <button
                  key={deal.id}
                  type="button"
                  className={
                    index === highlighted ? `${styles.option} ${styles.highlighted}` : styles.option
                  }
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => commit(deal)}
                >
                  {deal.company_name}
                </button>
              ))
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}
