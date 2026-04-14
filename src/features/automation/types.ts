import type { AppView } from '../../app/navigation'
import type {
  ExpenseModuleFilter,
  InvoiceModuleFilter,
  JobModuleFilter,
  PaymentModuleFilter,
  QuoteModuleFilter,
} from '../../app/moduleFilters'

export type AutomationAlertSeverity = 'critical' | 'warning' | 'info'

export type AutomationAlertRuleId =
  | 'public_intake_lead_drafts_pending'
  | 'unpaid_invoices_older_threshold'
  | 'completed_jobs_without_invoice_older_threshold'
  | 'accepted_quotes_without_job_older_threshold'
  | 'expenses_missing_support'
  | 'expenses_pending_fiscal_review'
  | 'quarter_closing_reminder'

export type AutomationAlertRouting =
  | {
      kind: 'module'
      view: AppView
      filterKey: 'invoices' | 'quotes' | 'jobs' | 'expenses' | 'payments'
      filterValue:
        | InvoiceModuleFilter
        | QuoteModuleFilter
        | JobModuleFilter
        | ExpenseModuleFilter
        | PaymentModuleFilter
    }
  | {
      kind: 'view'
      view: AppView
    }
  | {
      kind: 'quarterly_closing'
      fiscalYear: number
      fiscalQuarter: number
    }

export interface AutomationAlertItem {
  id: string
  ruleId: AutomationAlertRuleId
  severity: AutomationAlertSeverity
  title: string
  summary: string
  detail: string
  count: number
  amount?: number
  ageContext?: string
  contextLabel?: string
  examples?: string[]
  routing: AutomationAlertRouting
}
