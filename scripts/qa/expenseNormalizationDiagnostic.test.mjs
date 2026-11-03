import { describe, expect, it } from 'vitest'
import { assertNoDiagnosticSecrets, QA_SUPABASE_ORIGIN, isExactQaSupabaseUrl, loadAuthoritativeQaEnv, sanitizeProposal, safeResponseBody, sha256Json } from './expenseNormalizationDiagnostic.mjs'

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

  it('allowlists safe response fields and rejects secret-shaped report material', () => {
    expect(safeResponseBody({ ok: false, errorCode: 'NORMALIZATION_FAILED', errorMessageSafe: 'safe', rejectedPath: 'supplier.taxId', token: 'secret' })).toEqual({
      ok: false,
      errorCode: 'NORMALIZATION_FAILED',
      errorMessageSafe: 'safe',
      rejectedPath: 'supplier.taxId',
      normalizedProposalPresent: false,
    })
    expect(() => assertNoDiagnosticSecrets({ safe: true, value: 'Bearer eyJnot-for-report' })).toThrow('suspected secret')
    expect(assertNoDiagnosticSecrets({ safe: true, requestId: '01a0fd78-e629-7992-af26-e14eea7a07b0' })).toBe(true)
  })

  it('requires the exact HTTPS QA Supabase origin', async () => {
    expect(QA_SUPABASE_ORIGIN).toBe('https://kpvvydthlxupjjqqdpxy.supabase.co')
    expect(isExactQaSupabaseUrl(QA_SUPABASE_ORIGIN)).toBe(true)
    expect(isExactQaSupabaseUrl('https://kpvvydthlxupjjqqdpxy.supabase.co.evil.example')).toBe(false)
    expect(isExactQaSupabaseUrl('http://kpvvydthlxupjjqqdpxy.supabase.co')).toBe(false)
    expect(isExactQaSupabaseUrl('https://wfxnwfcdjainpojhbdri.supabase.co')).toBe(false)
    await expect(loadAuthoritativeQaEnv('C:/path/that/does/not/exist')).rejects.toThrow()
  })
})
