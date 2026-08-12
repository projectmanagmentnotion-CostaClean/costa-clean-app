import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import { QuoteDocumentA4 } from './QuoteDocumentA4'
import type { QuoteListItem } from './types'

function buildQuote(overrides: Partial<QuoteListItem> = {}): QuoteListItem {
  return {
    id: 'quote-1',
    display_code: 'QUO-0056',
    client_id: 'client-1',
    property_id: 'property-1',
    status: 'sent',
    subtotal: 3978,
    tax_amount: 835.38,
    total: 4813.38,
    notes: 'Servicio de camareros',
    internal_notes: null,
    pricing_metadata: null,
    created_at: '2026-08-12T00:00:00.000Z',
    updated_at: '2026-08-12T00:00:00.000Z',
    ...overrides,
  }
}

function buildClient(overrides: Partial<ClientListItem> = {}): ClientListItem {
  return {
    id: 'client-1',
    display_code: 'CLI-001',
    full_name: 'COSTA DEL MARESME HOSPITALITY MNG, S.L',
    phone: null,
    email: null,
    tax_id: 'B24859803',
    billing_address: 'Passatge d’en Sagristà, 11, 08029 - BCN',
    status: 'active',
    source_lead_id: null,
    ...overrides,
  }
}

function buildProperty(overrides: Partial<PropertyListItem> = {}): PropertyListItem {
  return {
    id: 'property-1',
    display_code: 'PRO-0018',
    client_id: 'client-1',
    name: 'Hotel Las Vegas',
    property_type: 'hotel',
    address: 'Carrer Example 1',
    city: 'Barcelona',
    postal_code: '08001',
    notes: null,
    status: 'active',
    archived_at: null,
    deleted_at: null,
    ...overrides,
  }
}

describe('QuoteDocumentA4', () => {
  it('shows fiscal client details before contact data in the cliente block', () => {
    const markup = renderToStaticMarkup(
      <QuoteDocumentA4
        quote={buildQuote()}
        clients={[buildClient()]}
        properties={[buildProperty()]}
      />,
    )

    expect(markup).toContain('COSTA DEL MARESME HOSPITALITY MNG, S.L')
    expect(markup).toContain('NIF/CIF: B24859803')
    expect(markup).toContain('Passatge d’en Sagristà, 11, 08029 - BCN')
    expect(markup).not.toContain('Sin telefono')
    expect(markup).not.toContain('Sin email')
  })

  it('does not add empty client rows when fiscal and contact fields are missing', () => {
    const markup = renderToStaticMarkup(
      <QuoteDocumentA4
        quote={buildQuote()}
        clients={[buildClient({ tax_id: null, billing_address: null, phone: null, email: null })]}
        properties={[buildProperty()]}
      />,
    )

    expect(markup).toContain('COSTA DEL MARESME HOSPITALITY MNG, S.L')
    expect(markup).not.toContain('NIF/CIF:')
    expect(markup).not.toContain('Passatge d’en Sagristà')
  })
})
