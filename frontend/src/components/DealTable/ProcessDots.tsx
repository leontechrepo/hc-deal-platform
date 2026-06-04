import type { Deal } from '../../types'

function parseLocalDate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const MILESTONES: { key: keyof Deal; label: string }[] = [
  { key: 'nda', label: 'NDA' },
  { key: 'dataroom', label: 'DR' },
  { key: 'mgmt_meeting', label: 'MM' },
  { key: 'ioi_offered', label: 'IOI' },
  { key: 'ioi_signed', label: 'SGN' },
]

interface Props {
  deal: Deal
}

export function ProcessDots({ deal }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
        {MILESTONES.map(({ key, label }) => {
          const done = deal[key] === 'P'
          return (
            <div
              key={key}
              title={label}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: done ? 'var(--green)' : 'var(--gray-200)',
                flexShrink: 0,
              }}
            />
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: '5px' }}>
        {MILESTONES.map(({ key, label }) => (
          <span key={key} style={{ fontSize: '9px', color: 'var(--gray-400)', width: 8, textAlign: 'center' }}>
            {label.charAt(0)}
          </span>
        ))}
      </div>
      {deal.target_close && (
        <div style={{ fontSize: '10px', color: 'var(--gray-400)', marginTop: 2, whiteSpace: 'nowrap' }}>
          Close: {parseLocalDate(deal.target_close).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })}
        </div>
      )}
    </div>
  )
}
