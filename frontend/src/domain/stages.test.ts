import { describe, expect, it } from 'vitest'
import {
  classifyMove,
  formatPipelineStage,
  isAtOrPastLockStage,
  statusNeedsReason,
  PIPELINE_STAGES,
} from './stages'

describe('stages', () => {
  it('has the 11 credit stages in funnel order', () => {
    expect(PIPELINE_STAGES[0]).toBe('sourcing')
    expect(PIPELINE_STAGES[6]).toBe('loi_signed')
    expect(PIPELINE_STAGES[10]).toBe('portfolio_monitoring')
  })

  it('labels stages and passes unknown keys through', () => {
    expect(formatPipelineStage('ic_approval')).toBe('IC Approval')
    expect(formatPipelineStage('odd')).toBe('odd')
    expect(formatPipelineStage(null)).toBeNull()
  })

  it('locks underwriting at loi_signed and later', () => {
    expect(isAtOrPastLockStage('loi_negotiation')).toBe(false)
    expect(isAtOrPastLockStage('loi_signed')).toBe(true)
    expect(isAtOrPastLockStage('documentation')).toBe(true)
    expect(isAtOrPastLockStage(null)).toBe(false)
  })

  it('requires a reason only for terminal statuses', () => {
    expect(statusNeedsReason('Active')).toBe(false)
    for (const s of ['On Hold', 'Passed', 'Dead', 'Closed']) expect(statusNeedsReason(s)).toBe(true)
  })

  describe('classifyMove', () => {
    it('treats single forward steps and back moves as frictionless', () => {
      expect(classifyMove('screening', 'pre_loi_diligence')).toEqual({ kind: 'forward' })
      expect(classifyMove('ic_approval', 'screening')).toEqual({ kind: 'back' })
      expect(classifyMove('screening', 'screening')).toEqual({ kind: 'same' })
    })

    it('flags a forward jump of two or more stages and lists what was skipped', () => {
      expect(classifyMove('sourcing', 'nda_execution')).toEqual({ kind: 'skip', skipped: ['intake_triage'] })
      const move = classifyMove('screening', 'loi_signed')
      expect(move).toEqual({ kind: 'skip', skipped: ['pre_loi_diligence', 'loi_negotiation'] })
    })
  })
})
