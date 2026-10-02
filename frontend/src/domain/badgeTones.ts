/**
 * leon-ui's `Badge` ships no colour: apps map their own status vocabulary onto
 * `bg`/`text`/`border`. Each tone resolves to CSS custom properties declared in
 * `styles/tokens.css` (`--tone-<name>-bg|text|border`), which flip under
 * `html.dark` — so badges follow the theme with no hook, no provider and no
 * re-render, and inline props still work.
 */
export interface BadgeToneProps {
  bg: string
  text: string
  border: string
}

export const BADGE_TONES = ['navy', 'gold', 'green', 'red', 'amber', 'blue', 'muted'] as const

export type BadgeTone = (typeof BADGE_TONES)[number]

/** The `Badge` props for a tone (theme-aware through CSS variables). */
export function badgeToneProps(tone: BadgeTone): BadgeToneProps {
  return {
    bg: `var(--tone-${tone}-bg)`,
    text: `var(--tone-${tone}-text)`,
    border: `var(--tone-${tone}-border)`,
  }
}

/** Hook-shaped alias of `badgeToneProps`, kept so call sites read the same as the RE app. */
export function useBadgeTone(tone: BadgeTone): BadgeToneProps {
  return badgeToneProps(tone)
}

// ---------------------------------------------------------------------------
// Domain vocabularies -> tone
// ---------------------------------------------------------------------------

const STAGE_TONE: Record<string, BadgeTone> = {
  sourcing: 'muted',
  intake_triage: 'muted',
  nda_execution: 'blue',
  screening: 'blue',
  pre_loi_diligence: 'blue',
  loi_negotiation: 'navy',
  loi_signed: 'navy',
  post_loi_diligence: 'gold',
  ic_approval: 'gold',
  documentation: 'gold',
  portfolio_monitoring: 'green',
}

/** Pipeline stage -> tone (early funnel muted, diligence blue, IC/doc gold, live green). */
export function stageTone(stage: string | null | undefined): BadgeTone {
  return (stage && STAGE_TONE[stage]) || 'muted'
}

const STATUS_TONE: Record<string, BadgeTone> = {
  Active: 'blue',
  'On Hold': 'amber',
  Passed: 'red',
  Dead: 'red',
  Closed: 'green',
}

/** Deal status -> tone. */
export function statusTone(status: string | null | undefined): BadgeTone {
  return (status && STATUS_TONE[status]) || 'muted'
}

/** NDA status -> tone. */
export function ndaTone(status: string | null | undefined): BadgeTone {
  switch (status) {
    case 'Signed':
      return 'green'
    case 'Sent':
      return 'amber'
    default:
      return 'muted'
  }
}

/** Approval decision (`approved` / `rejected` / `pending` / ...) -> tone. */
export function approvalTone(status: string | null | undefined): BadgeTone {
  switch ((status ?? '').toLowerCase()) {
    case 'approved':
    case 'applied':
      return 'green'
    case 'rejected':
    case 'denied':
      return 'red'
    case 'pending':
    case 'proposed':
      return 'amber'
    default:
      return 'muted'
  }
}

/** Portfolio risk rating (Pass / Watch) -> tone. */
export function riskTone(risk: string | null | undefined): BadgeTone {
  if (risk === 'Pass') return 'green'
  if (risk === 'Watch') return 'amber'
  return 'muted'
}

/** Portfolio payment status -> tone. */
export function paymentStatusTone(status: string | null | undefined): BadgeTone {
  switch (status) {
    case 'Current':
      return 'green'
    case 'PIK':
    case 'Past Due':
      return 'amber'
    case 'Default':
      return 'red'
    default:
      return 'muted'
  }
}

/** Covenant test result text (free-form: "Pass", "Breach", "Waived"...) -> tone. */
export function covenantStatusTone(status: string | null | undefined): BadgeTone {
  const s = (status ?? '').toLowerCase()
  if (!s) return 'muted'
  if (s.includes('breach') || s.includes('default') || s.includes('fail')) return 'red'
  if (s.includes('watch') || s.includes('waive') || s.includes('cure') || s.includes('tight')) return 'amber'
  if (s.includes('pass') || s.includes('compliant') || s.includes('ok')) return 'green'
  return 'muted'
}

/** Mailbox scan run status -> tone. */
export function scanRunTone(status: string | null | undefined): BadgeTone {
  switch (status) {
    case 'running':
      return 'amber'
    case 'completed':
    case 'succeeded':
      return 'green'
    case 'skipped_locked':
      return 'muted'
    default:
      return 'red'
  }
}

/** Activity-log entry type -> tone. */
export function activityTone(type: string | null | undefined): BadgeTone {
  switch (type) {
    case 'stage_change':
      return 'navy'
    case 'document':
    case 'email':
      return 'blue'
    case 'approval':
      return 'green'
    case 'status_change':
      return 'gold'
    default:
      return 'muted'
  }
}
