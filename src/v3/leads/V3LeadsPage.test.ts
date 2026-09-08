import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { V3LeadsPage } from './V3LeadsPage'

const lead = { id: 'lead-1', display_code: 'LEAD-0001', full_name: 'Carlos Montero', phone: '+34600123123', email: 'carlos@example.com', city: 'Barcelona', status: 'new', archived_at: null, converted_client_id: null }

describe('V3LeadsPage', () => {
  it('renders real lead list data and certified status filters', () => {
    const html = renderToStaticMarkup(createElement(V3LeadsPage, { leads: [lead], leadDrafts: [], clients: [], quotes: [], error: null, onCreateLead: () => undefined, onRefresh: async () => undefined, onOpenQuote: () => undefined, onOpenClient: () => undefined, onOpenLeadDeepLink: () => undefined, onBackToLeadList: () => undefined }))
    expect(html).toContain('Carlos Montero')
    expect(html).toContain('Nuevos')
    expect(html).not.toContain('LeadDetailCard')
  })
})
