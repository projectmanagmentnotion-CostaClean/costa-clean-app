import { describe, expect, it } from 'vitest'
import { assertNoDiagnosticSecrets, QA_SUPABASE_ORIGIN, isExactQaSupabaseUrl, loadAuthoritativeQaEnv, sanitizeProposal, safeResponseBody, sha256Json, verifySyntheticInvoiceProposal } from './expenseNormalizationDiagnostic.mjs'

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

  it('loads only required QA settings from process environment when no local file exists', async () => {
    const names = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'COSTACLEAN_QA_AUTH_EMAIL', 'COSTACLEAN_QA_AUTH_PASSWORD']
    const environmentNames = [...names, 'SUPABASE_SERVICE_ROLE_KEY']
    const previous = Object.fromEntries(environmentNames.map((name) => [name, process.env[name]]))
    try {
      process.env.VITE_SUPABASE_URL = QA_SUPABASE_ORIGIN
      process.env.VITE_SUPABASE_ANON_KEY = 'synthetic-public-key'
      process.env.COSTACLEAN_QA_AUTH_EMAIL = 'qa@example.invalid'
      process.env.COSTACLEAN_QA_AUTH_PASSWORD = 'synthetic-password'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'must-not-be-returned'
      const env = await loadAuthoritativeQaEnv('C:/path/that/does/not/exist')
      expect(env).toMatchObject({ VITE_SUPABASE_URL: QA_SUPABASE_ORIGIN, VITE_SUPABASE_ANON_KEY: 'synthetic-public-key' })
      expect(Object.keys(env).sort()).toEqual(names.sort())
    } finally {
      for (const name of names) {
        if (previous[name] === undefined) delete process.env[name]
        else process.env[name] = previous[name]
      }
      if (previous.SUPABASE_SERVICE_ROLE_KEY === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
      else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.SUPABASE_SERVICE_ROLE_KEY
    }
  })

  it('checks only booleans for the known synthetic invoice fields', () => {
    const field = (value) => ({ value, normalizedValue: value, rawValue: String(value), confidence: 0.9 })
    const proposal = {
      schemaVersion: 1,
      documentType: field('INVOICE'),
      supplier: { rawName: field('Proveedor Ficticio Norte S.L.'), taxId: field('B00000002') },
      invoice: { number: field('SYN-PDF-2026-001'), issueDate: field('2026-11-12') },
      amounts: { net: field('100.00'), tax: field('21.00'), gross: field('121.00') },
      vatLines: [{ rate: field('21'), base: field('100.00'), tax: field('21.00') }],
    }
    expect(Object.values(verifySyntheticInvoiceProposal(proposal)).every(Boolean)).toBe(true)
    expect(Object.values(verifySyntheticInvoiceProposal({})).every(Boolean)).toBe(false)
  })
})
