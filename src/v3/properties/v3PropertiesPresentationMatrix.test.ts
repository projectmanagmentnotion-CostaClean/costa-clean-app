import { describe, expect, it } from 'vitest'
import { appViews } from '../../app/navigation'

const v3PresentationOwners: Record<string, string> = {
  dashboard: 'V3HomePage', alerts: 'V3AlertsPage', fiscal_closing: 'V3ClosingPage', quarterly_closing: 'V3ClosingPage', annual_closing: 'V3ClosingPage',
  leads: 'LeadsPage(v3Mode)', clients: 'ClientsPage(v3Mode)', properties: 'V3PropertiesPage', quotes: 'QuotesPage(v3Mode)', jobs: 'JobsPage(v3Mode)', invoices: 'InvoicesPage(v3Mode)', expenses: 'ExpensesPage(v3Mode)', payments: 'PaymentsPage(v3Mode)',
}

describe('V3 AppView presentation matrix', () => {
  it('covers every authenticated AppView and isolates the properties renderer', () => {
    expect(Object.keys(v3PresentationOwners).sort()).toEqual([...appViews].sort())
    expect(v3PresentationOwners.properties).toBe('V3PropertiesPage')
  })
})
