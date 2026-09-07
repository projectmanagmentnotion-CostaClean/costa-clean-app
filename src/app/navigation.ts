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

export const appNavigationViews: AppView[] = [
  'dashboard',
  'leads',
  'clients',
  'properties',
  'quotes',
  'jobs',
  'invoices',
  'payments',
  'expenses',
  'fiscal_closing',
]

export const mobilePrimaryNavigationViews: AppView[] = ['dashboard', 'clients', 'jobs', 'invoices']
export const mobileSecondaryNavigationViews: AppView[] = [
  'alerts',
  'leads',
  'properties',
  'quotes',
  'payments',
  'expenses',
  'fiscal_closing',
]

export function isAppNavigationItemActive(itemView: AppView, currentView: AppView): boolean {
  if (itemView === currentView) return true

  return itemView === 'fiscal_closing'
    && (currentView === 'annual_closing' || currentView === 'quarterly_closing')
}
