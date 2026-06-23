import type { AppView } from './navigation'
import type { RefreshScope } from './refreshInvalidation'

export const appDataDomains = [
  'leads',
  'leadDrafts',
  'clients',
  'properties',
  'quotes',
  'jobs',
  'invoices',
  'payments',
  'expenses',
  'recurringInvoicePlans',
  'quarterlyClosings',
  'annualClosings',
] as const

export type AppDataDomain = (typeof appDataDomains)[number]

const scopeDomainMap: Record<RefreshScope, AppDataDomain[]> = {
  all: [...appDataDomains],
  billing: ['quotes', 'jobs', 'invoices', 'payments', 'expenses', 'recurringInvoicePlans'],
  operations: ['leads', 'leadDrafts', 'clients', 'properties'],
  closings: ['quarterlyClosings', 'annualClosings'],
}

const viewDomainMap: Record<AppView, AppDataDomain[]> = {
  dashboard: ['leads', 'leadDrafts', 'clients', 'properties', 'quotes', 'jobs', 'invoices', 'payments', 'expenses', 'recurringInvoicePlans', 'quarterlyClosings'],
  alerts: ['leadDrafts', 'quotes', 'jobs', 'invoices', 'payments', 'expenses', 'recurringInvoicePlans', 'quarterlyClosings'],
  fiscal_closing: ['clients', 'properties', 'quotes', 'invoices', 'payments', 'expenses', 'quarterlyClosings', 'annualClosings'],
  quarterly_closing: ['clients', 'properties', 'quotes', 'invoices', 'payments', 'expenses', 'quarterlyClosings', 'annualClosings'],
  annual_closing: ['clients', 'properties', 'quotes', 'invoices', 'payments', 'expenses', 'quarterlyClosings', 'annualClosings'],
  leads: ['leads', 'leadDrafts', 'clients'],
  clients: ['clients', 'properties', 'quotes', 'jobs', 'invoices', 'payments', 'recurringInvoicePlans'],
  properties: ['clients', 'properties', 'quotes', 'jobs', 'invoices', 'payments'],
  quotes: ['clients', 'properties', 'quotes'],
  jobs: ['clients', 'properties', 'quotes', 'jobs', 'invoices', 'payments'],
  invoices: ['clients', 'properties', 'quotes', 'jobs', 'invoices', 'payments'],
  expenses: ['expenses'],
  payments: ['clients', 'properties', 'quotes', 'jobs', 'invoices', 'payments'],
}

export function getDomainsForScope(scope: RefreshScope): AppDataDomain[] {
  return scopeDomainMap[scope]
}

export function getDomainsForView(view: AppView): AppDataDomain[] {
  return viewDomainMap[view]
}

export function mergeDomains(
  left: Iterable<AppDataDomain>,
  right: Iterable<AppDataDomain>,
): AppDataDomain[] {
  return [...new Set([...left, ...right])]
}

export function filterDomainsByLoadedState(
  domains: Iterable<AppDataDomain>,
  loadedDomains: ReadonlySet<AppDataDomain>,
): AppDataDomain[] {
  return [...domains].filter((domain) => loadedDomains.has(domain))
}
