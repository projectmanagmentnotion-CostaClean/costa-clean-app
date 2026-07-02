import { describe, expect, it } from 'vitest'
import { buildModuleHealthSummaries, classifyDataHealthIssue, extractMissingColumn } from './dataHealth'

describe('dataHealth', () => {
  it('extracts the missing column from REST schema errors', () => {
    expect(extractMissingColumn('REST 400: column properties.status does not exist')).toBe('properties.status')
  })

  it('classifies missing table, permission and auth errors', () => {
    expect(classifyDataHealthIssue(400, 'Could not find the table public.recurring_invoice_plans in the schema cache')).toBe('missing_table')
    expect(classifyDataHealthIssue(401, 'permission denied for table job_lines')).toBe('permission')
    expect(classifyDataHealthIssue(401, 'Authentication required for financial writes.')).toBe('auth')
  })

  it('marks modules as error when one of their domains is failing', () => {
    const summaries = buildModuleHealthSummaries({
      properties: 'REST 400: column properties.status does not exist',
      recurringInvoicePlans: 'Could not find the table public.recurring_invoice_plans in the schema cache',
    })

    expect(summaries.find((summary) => summary.view === 'properties')).toMatchObject({
      status: 'error',
      failingDomains: ['properties'],
    })
    expect(summaries.find((summary) => summary.view === 'dashboard')).toMatchObject({
      status: 'error',
      failingDomains: ['properties', 'recurringInvoicePlans'],
    })
  })
})
