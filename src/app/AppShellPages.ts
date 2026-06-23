import { lazy } from 'react'

export const AppShellPages = {
  AlertsCenterPage: lazy(async () => ({ default: (await import('../pages/AlertsCenterPage')).AlertsCenterPage })),
  ClientsPage: lazy(async () => ({ default: (await import('../pages/ClientsPage')).ClientsPage })),
  ExpensesPage: lazy(async () => ({ default: (await import('../pages/ExpensesPage')).ExpensesPage })),
  FiscalClosingPage: lazy(async () => ({ default: (await import('../pages/FiscalClosingPage')).FiscalClosingPage })),
  HomePage: lazy(async () => ({ default: (await import('../pages/HomePage')).HomePage })),
  InvoicesPage: lazy(async () => ({ default: (await import('../pages/InvoicesPage')).InvoicesPage })),
  JobsPage: lazy(async () => ({ default: (await import('../pages/JobsPage')).JobsPage })),
  LeadsPage: lazy(async () => ({ default: (await import('../pages/LeadsPage')).LeadsPage })),
  PaymentsPage: lazy(async () => ({ default: (await import('../pages/PaymentsPage')).PaymentsPage })),
  PropertiesPage: lazy(async () => ({ default: (await import('../pages/PropertiesPage')).PropertiesPage })),
  QuotesPage: lazy(async () => ({ default: (await import('../pages/QuotesPage')).QuotesPage })),
}
