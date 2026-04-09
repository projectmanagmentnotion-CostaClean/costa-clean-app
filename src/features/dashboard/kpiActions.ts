import type { AppView } from '../../app/navigation'
import type {
  ExpenseModuleFilter,
  InvoiceModuleFilter,
  JobModuleFilter,
  ModuleFilterState,
  PaymentModuleFilter,
  QuoteModuleFilter,
} from '../../app/moduleFilters'

export type DashboardKpiActionId =
  | 'invoiced_this_month'
  | 'collected_this_month'
  | 'outstanding_invoices'
  | 'completed_jobs_without_invoice'
  | 'accepted_quotes_without_job'
  | 'expenses_this_month'
  | 'pending_invoices'
  | 'open_quotes'
  | 'scheduled_jobs'
  | 'expenses_without_receipt'

interface DashboardKpiActionConfig {
  id: DashboardKpiActionId
  view: AppView
  filterKey: keyof ModuleFilterState
  filterValue: InvoiceModuleFilter | QuoteModuleFilter | JobModuleFilter | ExpenseModuleFilter | PaymentModuleFilter
}

export const dashboardKpiActionConfig: Record<DashboardKpiActionId, DashboardKpiActionConfig> = {
  invoiced_this_month: {
    id: 'invoiced_this_month',
    view: 'invoices',
    filterKey: 'invoices',
    filterValue: 'current_month',
  },
  collected_this_month: {
    id: 'collected_this_month',
    view: 'payments',
    filterKey: 'payments',
    filterValue: 'current_month',
  },
  outstanding_invoices: {
    id: 'outstanding_invoices',
    view: 'invoices',
    filterKey: 'invoices',
    filterValue: 'pending',
  },
  completed_jobs_without_invoice: {
    id: 'completed_jobs_without_invoice',
    view: 'jobs',
    filterKey: 'jobs',
    filterValue: 'completed_without_invoice',
  },
  accepted_quotes_without_job: {
    id: 'accepted_quotes_without_job',
    view: 'quotes',
    filterKey: 'quotes',
    filterValue: 'accepted_without_job',
  },
  expenses_this_month: {
    id: 'expenses_this_month',
    view: 'expenses',
    filterKey: 'expenses',
    filterValue: 'current_month',
  },
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
