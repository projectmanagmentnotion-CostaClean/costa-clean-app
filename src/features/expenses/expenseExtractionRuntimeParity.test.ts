import { describe, expect, it } from 'vitest'
import { validateExtractionProposal } from './expenseExtractionContract'
import { createServerFixtureProposal, missing } from '../../../supabase/functions/expense-document-extraction/fixtureProposal'
import { validateServerProposal } from '../../../supabase/functions/expense-document-extraction/proposalValidation'
import { isQaFixtureRuntimeConfigured, QA_PROJECT_REF, SERVER_FIXTURE_ENV_NAME } from '../../../supabase/functions/expense-document-extraction/runtimeGuards'

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const fixture = createServerFixtureProposal()

describe('N5.2 QA Edge runtime R2.1 contract parity', () => {
  it('passes the exact server fixture through the canonical frontend validator', () => {
    expect(validateServerProposal(fixture)).toBe(true)
    expect(validateExtractionProposal(fixture).ok).toBe(true)
  })

  it('uses canonical missing fields without nullable evidence', () => {
    expect(missing()).toEqual({ value: null, rawValue: null, confidence: null, source: 'missing' })
    expect(validateExtractionProposal(fixture).ok).toBe(true)
    expect(validateServerProposal({ ...fixture, supplier: { ...(fixture.supplier as Record<string, unknown>), vatId: { ...missing(), evidence: null } } })).toBe(false)
  })

  it.each([
    ['missing value semantics', { ...missing(), value: 'leak' }],
    ['confidence over one', { value: 'x', rawValue: 'x', confidence: 1.1, source: 'provider' }],
    ['money number', { ...missing(), value: 12.1, source: 'provider' }],
    ['invalid document type', { ...(fixture.documentType as Record<string, unknown>), value: 'NOT_A_DOCUMENT' }],
    ['malformed VAT line', { rate: missing(), base: missing() }],
    ['invalid bounding box', { value: 'x', rawValue: 'x', confidence: 0.9, source: 'document', evidence: { boundingBox: { x: 0, y: 0, width: -1, height: 2 } } }],
  ])('rejects %s as INVALID_PROVIDER_RESPONSE input', (_label, malformed) => {
    const proposal = clone(fixture)
    if (_label === 'missing value semantics') (proposal.supplier as Record<string, unknown>).vatId = malformed
    if (_label === 'confidence over one') (proposal.supplier as Record<string, unknown>).vatId = malformed
    if (_label === 'money number') (proposal.amounts as Record<string, unknown>).net = malformed
    if (_label === 'invalid document type') proposal.documentType = malformed
    if (_label === 'malformed VAT line') proposal.vatLines = [malformed]
    if (_label === 'invalid bounding box') (proposal.supplier as Record<string, unknown>).rawName = malformed
    expect(validateServerProposal(proposal)).toBe(false)
    expect(validateExtractionProposal(proposal).ok).toBe(false)
  })

  it('rejects missing supplier and invoice fields', () => {
    const supplierMissing = clone(fixture)
    delete (supplierMissing.supplier as Record<string, unknown>).rawName
    const invoiceMissing = clone(fixture)
    delete (invoiceMissing.invoice as Record<string, unknown>).number
    expect(validateServerProposal(supplierMissing)).toBe(false)
    expect(validateServerProposal(invoiceMissing)).toBe(false)
  })

  it('requires both the exact QA project pin and the server-only fixture environment gate', () => {
    expect(SERVER_FIXTURE_ENV_NAME).toBe('N52_SERVER_FIXTURE_MODE')
    expect(QA_PROJECT_REF).toBe('kpvvydthlxupjjqqdpxy')
    expect(isQaFixtureRuntimeConfigured(`https://${QA_PROJECT_REF}.supabase.co`, 'qa-fixture')).toBe(true)
    expect(isQaFixtureRuntimeConfigured(`https://${QA_PROJECT_REF}.supabase.co`, '')).toBe(false)
    expect(isQaFixtureRuntimeConfigured('https://wfxnwfcdjainpojhbdri.supabase.co', 'qa-fixture')).toBe(false)
  })
})
