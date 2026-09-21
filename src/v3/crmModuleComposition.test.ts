import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3LeadRow } from './leads/V3LeadRow'
import { V3PropertyRow } from './properties/V3PropertyRow'
import { V3PropertiesPage, V3PropertyWorkspace } from './properties/V3PropertiesPage'

const home = readFileSync(resolve(process.cwd(), 'src/v3/home/V3HomePage.tsx'), 'utf8')
const clients = readFileSync(resolve(process.cwd(), 'src/v3/clients/V3ClientsPage.tsx'), 'utf8')
const leads = readFileSync(resolve(process.cwd(), 'src/v3/leads/V3LeadsPage.tsx'), 'utf8')
const leadRow = readFileSync(resolve(process.cwd(), 'src/v3/leads/V3LeadRow.tsx'), 'utf8')
const propertyRow = readFileSync(resolve(process.cwd(), 'src/v3/properties/V3PropertyRow.tsx'), 'utf8')
const v3Css = readFileSync(resolve(process.cwd(), 'src/v3/design/v3.css'), 'utf8')

const client = { id: 'client-1', display_code: 'CLI-0001', full_name: 'Ana Costa', phone: null, email: null, tax_id: null, billing_address: null, status: 'active', source_lead_id: null }
const property = { id: 'property-1', display_code: 'PROP-0001', client_id: 'client-1', client_name: 'Ana Costa', client_display_code: 'CLI-0001', name: 'Apartamento Centro', status: 'active', archived_at: null, deleted_at: null, property_type: 'apartment', address: 'Calle Mayor 1', city: 'Málaga', postal_code: '29001', notes: null }
const propertyPageProps = { properties: [property], clients: [client], jobs: [], quotes: [], invoices: [], payments: [], error: null, onRefresh: async () => undefined, onOpenClient: () => undefined, onOpenClients: () => undefined, onOpenJob: () => undefined, onOpenQuote: () => undefined, onOpenInvoice: () => undefined, onOpenPayment: () => undefined, onCreateJob: () => undefined, onCreateQuote: () => undefined, onCreateInvoice: () => undefined }

describe('V3-10C3 module composition contracts', () => {
  it('keeps real Home attention work inside the executive dashboard composition', () => {
    expect(home.indexOf('<V3HomePriorityQueue')).toBeGreaterThan(-1)
    expect(home.indexOf('<V3KpiGroup')).toBeGreaterThan(-1)
    expect(home.indexOf('<V3KpiGroup')).toBeLessThan(home.indexOf('<V3HomePriorityQueue'))
  })

  it('keeps CRM search before KPI summaries and Leads KPI summary before its search', () => {
    expect(clients.indexOf('className="v3-crm-search"')).toBeLessThan(clients.indexOf('<V3KpiGroup>'))
    expect(clients).not.toContain('<V3SecondaryAction onClick={() => setIsFilterOpen(true)}>Filtros</V3SecondaryAction>')
    expect(leads.indexOf('<V3KpiGroup className="v3-leads-kpi-summary"')).toBeLessThan(leads.indexOf('className="v3-leads-controls"'))
  })

  it('keeps relationship rows human-readable and gives CRM rows semantic styling hooks', () => {
    expect(leadRow).toContain('className="v3-lead-row"')
    expect(propertyRow).toContain('className="v3-property-row"')
    expect(propertyRow).not.toContain('{property.id}')
  })

  it('protects compact property media and mobile row composition', () => {
    expect(v3Css).toContain('.v3-properties-controls')
    expect(v3Css).toContain('.v3-property-row { align-items: start; grid-template-columns: 76px minmax(0, 1fr); }')
    expect(v3Css).toContain('.v3-property-workspace__media { max-height: 150px; }')
  })

  it('keeps search contracts controlled and renders empty states without speculative data', () => {
    expect(clients).toContain('value={searchQuery}')
    expect(clients).toContain('setSearchQuery(event.target.value)')
    expect(leads).toContain('value={search}')
    expect(leads).toContain('setSearch(event.target.value)')
    const emptyProperties = renderToStaticMarkup(createElement(V3PropertiesPage, { ...propertyPageProps, properties: [], clients: [] }))
    expect(emptyProperties).toContain('Sin inmuebles visibles')
    expect(emptyProperties).toContain('+ Nuevo inmueble')
    expect(emptyProperties).not.toContain('property-1')
  })

  it('renders human-readable client/property relationships and never exposes relation ids', () => {
    const html = renderToStaticMarkup(createElement(V3PropertyWorkspace, {
      property,
      clients: [client],
      jobs: [],
      quotes: [],
      invoices: [],
      payments: [],
      activeTab: 'summary',
      onTabChange: () => undefined,
      onBack: () => undefined,
      onEdit: () => undefined,
      onOpenClient: () => undefined,
      onOpenJob: () => undefined,
      onOpenQuote: () => undefined,
      onOpenInvoice: () => undefined,
      onOpenPayment: () => undefined,
      onCreateJob: () => undefined,
      onCreateQuote: () => undefined,
      onCreateInvoice: () => undefined,
    }))
    expect(html).toContain('Ana Costa')
    expect(html).toContain('Apartamento Centro')
    expect(html).toContain('Nuevo servicio')
    expect(html).not.toContain('property-1')
    expect(html).not.toContain('client-1')
  })

  it('keeps property media fallback, accessible row names and optional data safe', () => {
    const propertyHtml = renderToStaticMarkup(createElement(V3PropertyRow, { property: { ...property, property_type: 'unknown' }, onOpen: () => undefined }))
    const leadHtml = renderToStaticMarkup(createElement(V3LeadRow, { lead: { id: 'lead-1', display_code: null, full_name: 'Carlos Montero', phone: '+34600123123', email: null, city: null, status: 'new', archived_at: null, converted_client_id: null }, onOpen: () => undefined }))
    const workspaceHtml = renderToStaticMarkup(createElement(V3PropertyWorkspace, {
      property: { ...property, client_id: 'missing-client', property_type: 'unknown', notes: null },
      clients: [],
      jobs: [],
      quotes: [],
      invoices: [],
      payments: [],
      activeTab: 'summary',
      onTabChange: () => undefined,
      onBack: () => undefined,
      onEdit: () => undefined,
      onOpenClient: () => undefined,
      onOpenJob: () => undefined,
      onOpenQuote: () => undefined,
      onOpenInvoice: () => undefined,
      onOpenPayment: () => undefined,
      onCreateJob: () => undefined,
      onCreateQuote: () => undefined,
      onCreateInvoice: () => undefined,
    }))
    expect(propertyHtml).toContain('/assets/properties/fallback.webp')
    expect(propertyHtml).toContain('aria-label="Abrir inmueble Apartamento Centro"')
    expect(leadHtml).toContain('aria-label="Abrir lead Carlos Montero"')
    expect(workspaceHtml).toContain('Cliente no disponible')
    expect(workspaceHtml).toContain('Sin notas registradas.')
  })
})
