import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  activityTone,
  approvalTone,
  covenantStatusTone,
  ndaTone,
  paymentStatusTone,
  BADGE_TONES,
  badgeToneProps,
  riskTone,
  scanRunTone,
  stageTone,
  statusTone,
} from './badgeTones'
import { PIPELINE_STAGES } from './stages'

describe('stageTone', () => {
  it('maps every one of the 11 credit stages to a tone', () => {
    expect(PIPELINE_STAGES).toHaveLength(11)
    for (const stage of PIPELINE_STAGES) {
      expect(stageTone(stage)).not.toBe(undefined)
    }
  })

  it('groups the funnel: early muted, diligence blue, LOI navy, IC/docs gold, live green', () => {
    expect(stageTone('sourcing')).toBe('muted')
    expect(stageTone('screening')).toBe('blue')
    expect(stageTone('loi_signed')).toBe('navy')
    expect(stageTone('ic_approval')).toBe('gold')
    expect(stageTone('portfolio_monitoring')).toBe('green')
  })

  it('falls back to muted for unknown or missing stages', () => {
    expect(stageTone('mystery')).toBe('muted')
    expect(stageTone(null)).toBe('muted')
  })
})

describe('statusTone', () => {
  it('maps deal statuses', () => {
    expect(statusTone('Active')).toBe('blue')
    expect(statusTone('On Hold')).toBe('amber')
    expect(statusTone('Passed')).toBe('red')
    expect(statusTone('Dead')).toBe('red')
    expect(statusTone('Closed')).toBe('green')
    expect(statusTone(undefined)).toBe('muted')
  })
})

describe('ndaTone / approvalTone', () => {
  it('maps NDA status', () => {
    expect(ndaTone('Signed')).toBe('green')
    expect(ndaTone('Sent')).toBe('amber')
    expect(ndaTone('Not Started')).toBe('muted')
  })

  it('maps approval decisions case-insensitively', () => {
    expect(approvalTone('Approved')).toBe('green')
    expect(approvalTone('rejected')).toBe('red')
    expect(approvalTone('PENDING')).toBe('amber')
    expect(approvalTone('')).toBe('muted')
  })
})

describe('portfolio tones', () => {
  it('maps risk ratings', () => {
    expect(riskTone('Pass')).toBe('green')
    expect(riskTone('Watch')).toBe('amber')
    expect(riskTone(null)).toBe('muted')
  })

  it('maps payment status', () => {
    expect(paymentStatusTone('Current')).toBe('green')
    expect(paymentStatusTone('PIK')).toBe('amber')
    expect(paymentStatusTone('Past Due')).toBe('amber')
    expect(paymentStatusTone('Default')).toBe('red')
  })

  it('maps free-form covenant status text', () => {
    expect(covenantStatusTone('Breach')).toBe('red')
    expect(covenantStatusTone('Waived')).toBe('amber')
    expect(covenantStatusTone('In compliance (pass)')).toBe('green')
    expect(covenantStatusTone('')).toBe('muted')
    expect(covenantStatusTone('n/a')).toBe('muted')
  })
})

describe('operational tones', () => {
  it('maps scan run status', () => {
    expect(scanRunTone('running')).toBe('amber')
    expect(scanRunTone('completed')).toBe('green')
    expect(scanRunTone('skipped_locked')).toBe('muted')
    expect(scanRunTone('error')).toBe('red')
  })

  it('maps activity types', () => {
    expect(activityTone('stage_change')).toBe('navy')
    expect(activityTone('email')).toBe('blue')
    expect(activityTone('whatever')).toBe('muted')
  })
})

describe('badgeToneProps', () => {
  it('resolves every tone to theme-aware CSS variables', () => {
    for (const tone of BADGE_TONES) {
      expect(badgeToneProps(tone)).toEqual({
        bg: `var(--tone-${tone}-bg)`,
        text: `var(--tone-${tone}-text)`,
        border: `var(--tone-${tone}-border)`,
      })
    }
  })

  it('declares every tone variable for light and dark in tokens.css', () => {
    const css = readFileSync(resolve(__dirname, '../styles/tokens.css'), 'utf8')
    const [light, dark] = css.split('\nhtml.dark {')
    for (const tone of BADGE_TONES) {
      for (const part of ['bg', 'text', 'border']) {
        const decl = `--tone-${tone}-${part}:`
        expect(light, `light ${decl}`).toContain(decl)
        expect(dark, `dark ${decl}`).toContain(decl)
      }
    }
  })
})
