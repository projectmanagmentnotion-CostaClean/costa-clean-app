export type RefreshScope = 'all' | 'billing' | 'operations' | 'closings'

export const realtimeTables = [
  'intake_submissions',
  'leads',
  'lead_drafts',
  'clients',
  'properties',
  'quotes',
  'quote_lines',
  'jobs',
  'job_lines',
  'invoices',
  'invoice_lines',
  'payments',
  'recurring_invoice_plans',
  'expenses',
  'quarterly_closings',
  'annual_closings',
] as const

export function isBrowserOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

export function combineRefreshScopes(left: RefreshScope | null, right: RefreshScope): RefreshScope {
  if (!left || left === right) return right
  if (left === 'all' || right === 'all') return 'all'
  return 'all'
}

export function getRefreshScopeForTable(table: string): RefreshScope {
  if (table === 'quarterly_closings' || table === 'annual_closings') return 'closings'
  if (table === 'intake_submissions' || table === 'leads' || table === 'lead_drafts' || table === 'clients' || table === 'properties') return 'operations'
  if (table === 'expenses') return 'all'
  return 'billing'
}
