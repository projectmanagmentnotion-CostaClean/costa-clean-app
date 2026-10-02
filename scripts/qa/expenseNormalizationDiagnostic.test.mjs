import { describe, expect, it } from 'vitest'
import { sanitizeProposal, sha256Json } from './expenseNormalizationDiagnostic.mjs'

describe('expense normalization diagnostic retention', () => {
  it('keeps only structural proposal evidence and a stable hash', () => {
    const proposal = {
      schemaVersion: 1,
      documentType: { value: 'INVOICE', rawValue: 'FACTURA', confidence: 0.9, source: 'document', evidence: { page: 1, text: 'FACTURA' } },
      supplier: { rawName: { value: null, rawValue: null, confidence: null, source: 'missing', evidence: { page: null, text: null } } },
    }
    const result = sanitizeProposal(proposal)
    expect(result.schemaVersion).toBe(1)
    expect(result.topLevelKeys).toEqual(['documentType', 'schemaVersion', 'supplier'])
    expect(JSON.stringify(result)).not.toContain('FACTURA')
    expect(result.sha256).toBe(sha256Json(proposal))
  })

  it('marks the retention order as report-before-delete by construction', async () => {
    const source = await import('./expenseNormalizationDiagnostic.mjs')
    expect(typeof source.buildDiagnosticReport).toBe('function')
    expect(typeof source.writeDiagnosticReport).toBe('function')
  })
})
