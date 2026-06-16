export const appViews = [
  'dashboard',
  'alerts',
  'fiscal_closing',
  'quarterly_closing',
  'annual_closing',
  'leads',
  'clients',
  'properties',
  'quotes',
  'jobs',
  'invoices',
  'expenses',
  'payments',
] as const

export type AppView = (typeof appViews)[number]
