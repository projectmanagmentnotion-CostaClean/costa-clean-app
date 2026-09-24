import { describe, expect, it } from 'vitest'
import { classifyQuoteRelationship } from './n1QuoteRelationship'

describe('N1 quote client-or-lead relationship contract', () => {
  it.each([
    ['lead quote', { clientId: null, leadId: 'lead-1', leadExists: true }, 'valid'],
    ['client quote', { clientId: 'client-1', leadId: null, clientExists: true }, 'valid'],
    ['both valid', { clientId: 'client-1', leadId: 'lead-1', clientExists: true, leadExists: true }, 'valid'],
    ['QUO-0033-shaped lead quote', { clientId: null, leadId: 'lead-1', leadExists: true }, 'valid'],
    ['invalid client', { clientId: 'client-1', leadId: null, clientExists: false }, 'orphan'],
    ['invalid lead', { clientId: null, leadId: 'lead-1', leadExists: false }, 'orphan'],
    ['both absent', { clientId: null, leadId: null }, 'orphan'],
    ['property contradicts client', { clientId: 'client-1', leadId: null, clientExists: true, propertyClientId: 'client-2' }, 'mismatch'],
  ])('%s is classified correctly', (_name, input, expected) => {
    expect(classifyQuoteRelationship(input)).toBe(expected)
  })
})
