import { describe, expect, it } from 'vitest'
import { buildQuotePdfFileName } from './quotePdfOutput'
import type { ClientListItem } from '../clients/types'
import type { QuoteListItem } from './types'

const quote = {
  id: 'quote-1',
  display_code: 'PRE-0042',
  client_id: 'client-1',
} as QuoteListItem

const client = {
  id: 'client-1',
  full_name: 'Cliente: "Ágil" / BCN',
} as ClientListItem

describe('buildQuotePdfFileName', () => {
  it('uses the reference and a filesystem-safe client name', () => {
    expect(buildQuotePdfFileName(quote, [client])).toBe('PRE-0042 - Cliente Ágil BCN - Presupuesto CostaClean.pdf')
  })
})
