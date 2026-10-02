import { describe, expect, it } from 'vitest'
import type { FeaturesInfo } from '../api/meta'
import { extractionAvailability, runDisabledReason } from '../components/documents/extractionModel'

const base: FeaturesInfo = {
  attachment_ingestion_enabled: true,
  document_extraction_enabled: true,
  document_extraction_flag: true,
  document_extraction_requires_ingestion: false,
  storage_backend: 's3',
  storage_configured: true,
  graph_folders: [],
}

describe('extraction availability from /meta/features', () => {
  it('is unknown until features load', () => {
    expect(extractionAvailability(undefined).state).toBe('unknown')
    expect(runDisabledReason(undefined, 1)).toMatch(/Checking/)
  })

  it('is on only when the effective flag is true', () => {
    expect(extractionAvailability(base).state).toBe('on')
    expect(runDisabledReason(base, 1)).toBeNull()
  })

  it('says extraction is off when the flag is off', () => {
    const f = { ...base, document_extraction_enabled: false, document_extraction_flag: false }
    const a = extractionAvailability(f)
    expect(a.state).toBe('off')
    expect(runDisabledReason(f, 1)).toBe('Extraction is off')
  })

  it('says it needs attachment ingestion when enabled but ingestion is off', () => {
    const f = {
      ...base,
      attachment_ingestion_enabled: false,
      document_extraction_enabled: false,
      document_extraction_requires_ingestion: true,
    }
    expect(runDisabledReason(f, 1)).toBe('Extraction is enabled but needs attachment ingestion')
  })

  it('requires a selection within the per-run limit', () => {
    expect(runDisabledReason(base, 0)).toMatch(/Select at least one/)
    expect(runDisabledReason(base, 11)).toMatch(/at most 10/)
  })
})
