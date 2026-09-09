import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3PropertiesPage } from './V3PropertiesPage'
import type { PropertyListItem } from '../../features/properties/types'

const property: PropertyListItem = { id: 'property-1', display_code: 'PROP-001', client_id: 'client-1', client_name: 'Ana Costa', client_display_code: 'CLI-001', name: 'Apartamento Centro', status: 'active', archived_at: null, deleted_at: null, property_type: 'apartment', address: 'Calle Mayor 1', city: 'Málaga', postal_code: '29001', notes: 'Acceso por portal.' }
const base = { properties: [property], clients: [{ id: 'client-1', display_code: 'CLI-001', full_name: 'Ana Costa', phone: null, email: null, tax_id: null, billing_address: null, status: 'active', source_lead_id: null }], jobs: [], quotes: [], invoices: [], payments: [], error: null, onRefresh: async () => undefined, onOpenClient: () => undefined, onOpenClients: () => undefined, onOpenJob: () => undefined, onOpenQuote: () => undefined, onOpenInvoice: () => undefined, onOpenPayment: () => undefined, onCreateJob: () => undefined, onCreateQuote: () => undefined, onCreateInvoice: () => undefined }

describe('V3PropertiesPage', () => {
  it('renders a compact searchable property list with real contract fields', () => {
    const html = renderToStaticMarkup(createElement(V3PropertiesPage, base))
    expect(html).toContain('Inmuebles')
    expect(html).toContain('Apartamento Centro')
    expect(html).toContain('Ana Costa')
    expect(html).toContain('Calle Mayor 1')
    expect(html).not.toContain('VisualKpiCard')
  })

  it('keeps the authenticated create and edit paths available', () => {
    const html = renderToStaticMarkup(createElement(V3PropertiesPage, base))
    expect(html).toContain('Nuevo inmueble')
    expect(html).toContain('Buscar')
  })
})
