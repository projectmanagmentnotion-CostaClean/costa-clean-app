import type { AppView } from '../../app/navigation'
import type {
  ExpenseModuleFilter,
  InvoiceModuleFilter,
  JobModuleFilter,
  ModuleFilterState,
  QuoteModuleFilter,
} from '../../app/moduleFilters'

export type DashboardKpiActionId =
  | 'pending_invoices'
  | 'open_quotes'
  | 'scheduled_jobs'
  | 'expenses_without_receipt'

interface DashboardKpiActionConfig {
  id: DashboardKpiActionId
  view: AppView
  filterKey: keyof ModuleFilterState
  filterValue: InvoiceModuleFilter | QuoteModuleFilter | JobModuleFilter | ExpenseModuleFilter
}

export const dashboardKpiActionConfig: Record<DashboardKpiActionId, DashboardKpiActionConfig> = {
  pending_invoices: {
    id: 'pending_invoices',
    view: 'invoices',
    filterKey: 'invoices',
    filterValue: 'pending',
  },
  open_quotes: {
    id: 'open_quotes',
    view: 'quotes',
    filterKey: 'quotes',
    filterValue: 'open',
  },
  scheduled_jobs: {
    id: 'scheduled_jobs',
    view: 'jobs',
    filterKey: 'jobs',
    filterValue: 'scheduled',
  },
  expenses_without_receipt: {
    id: 'expenses_without_receipt',
    view: 'expenses',
    filterKey: 'expenses',
    filterValue: 'missing_receipt',
  },
}

export function applyDashboardKpiAction(currentFilters: ModuleFilterState, actionId: DashboardKpiActionId): ModuleFilterState {
  const action = dashboardKpiActionConfig[actionId]

  return {
    ...currentFilters,
    [action.filterKey]: action.filterValue,
  }
}
