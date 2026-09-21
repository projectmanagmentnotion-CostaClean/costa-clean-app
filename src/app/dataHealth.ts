import type { AppView } from './navigation'
import { getDomainsForView } from './dataLoadingPlan'
import { getAppViewLabel } from './displayText'
import { getAuthenticatedReadContext, type AuthenticatedReadContext } from '../lib/supabaseRest'

export interface DataHealthProbeDefinition {
  key: string
  table: string
  module: AppView
  selectMode: 'minimal' | 'app'
  path: string
}

export interface DataHealthProbeResult extends DataHealthProbeDefinition {
  ok: boolean
  statusCode: number | null
  detail: string
  issueType: 'missing_column' | 'missing_table' | 'permission' | 'auth' | 'other'
  missingColumn: string | null
}

export interface ModuleHealthSummary {
  view: AppView
  label: string
  status: 'ok' | 'error'
  failingDomains: string[]
}

export const dataHealthProbeDefinitions: DataHealthProbeDefinition[] = [
  { key: 'leads-app', table: 'leads', module: 'leads', selectMode: 'app', path: 'leads?select=id,display_code,full_name,phone,email,city,status,archived_at,public_intake_last_submission_id,converted_client_id,converted_at&order=created_at.desc&limit=1' },
  { key: 'clients-app', table: 'clients', module: 'clients', selectMode: 'app', path: 'clients?select=id,display_code,created_at,full_name,phone,email,tax_id,billing_address,status,archived_at,deleted_at,source_lead_id&order=created_at.desc&limit=1' },
  { key: 'properties-app', table: 'properties', module: 'properties', selectMode: 'app', path: 'properties?select=id,display_code,client_id,name,status,archived_at,deleted_at,property_type,address,city,postal_code,notes&order=created_at.desc&limit=1' },
  { key: 'quotes-app', table: 'quotes', module: 'quotes', selectMode: 'app', path: 'quotes?select=id,display_code,lead_id,client_id,property_id,status,archived_at,deleted_at,cancelled_at,cancel_reason,subtotal,tax_amount,total,notes,internal_notes,pricing_metadata,created_at,updated_at&order=created_at.desc&limit=1' },
  { key: 'jobs-app', table: 'jobs', module: 'jobs', selectMode: 'app', path: 'jobs?select=id,display_code,client_id,property_id,quote_id,scheduled_date,status,archived_at,deleted_at,cancelled_at,cancel_reason,updated_at,service_type,billing_concept,billing_quantity,billing_unit,billing_unit_price,notes&order=created_at.desc&limit=1' },
  { key: 'job-lines-app', table: 'job_lines', module: 'jobs', selectMode: 'app', path: 'job_lines?select=id,job_id,sort_order,concept,quantity,unit,unit_price,line_subtotal,created_at&order=sort_order.asc&limit=1' },
  { key: 'invoices-app', table: 'invoices', module: 'invoices', selectMode: 'app', path: 'invoices?select=id,display_code,invoice_number,job_id,quote_id,client_id,property_id,issue_date,status,created_at,archived_at,deleted_at,cancelled_at,cancel_reason,updated_at,subtotal,tax_amount,total,notes,internal_notes,pricing_metadata&order=created_at.desc&limit=1' },
  { key: 'invoice-lines-app', table: 'invoice_lines', module: 'invoices', selectMode: 'app', path: 'invoice_lines?select=id,invoice_id,sort_order,concept,quantity,unit,unit_price,line_subtotal,created_at&order=sort_order.asc&limit=1' },
  { key: 'payments-app', table: 'payments', module: 'payments', selectMode: 'app', path: 'payments?select=id,display_code,invoice_id,payment_date,created_at,amount,payment_method,origin_type,notes&order=created_at.desc&limit=1' },
  { key: 'expenses-app', table: 'expenses', module: 'expenses', selectMode: 'app', path: 'expenses?select=id,display_code,expense_number,expense_date,accounting_date,due_date,supplier_name,supplier_tax_id,category,subcategory,description,document_type,reference_number,payment_method,payment_status,currency,subtotal,tax_rate,tax_amount,total,is_deductible,deductible_percentage,affects_quarterly_closure,affects_annual_closure,receipt_file_url,receipt_file_path,attachment_count,document_support_status,fiscal_review_status,fiscal_risk_level,manager_note,ai_fiscal_classification,ai_deductibility_percentage,ai_vat_deductibility_percentage,ai_estimated_deductible_base,ai_estimated_deductible_vat,ai_fiscal_confidence,ai_fiscal_risk_level,ai_fiscal_reasoning,ai_fiscal_flags,ai_fiscal_model,ai_fiscal_analyzed_at,ai_fiscal_source_version,notes,fiscal_year,fiscal_quarter,created_at,updated_at&limit=1' },
  { key: 'recurring-app', table: 'recurring_invoice_plans', module: 'dashboard', selectMode: 'app', path: 'recurring_invoice_plans?select=id,client_id,property_id,quote_id,title,frequency,status,default_invoice_status,next_issue_date,last_issued_at,tax_rate,notes,internal_notes,pricing_metadata,template_lines,created_at,updated_at&order=next_issue_date.asc&limit=1' },
  { key: 'quarterly-closings-app', table: 'quarterly_closings', module: 'fiscal_closing', selectMode: 'app', path: 'quarterly_closings?select=id,fiscal_year,fiscal_quarter,status,closed_at,notes,snapshot_json,created_at,updated_at&order=created_at.desc&limit=1' },
  { key: 'annual-closings-app', table: 'annual_closings', module: 'fiscal_closing', selectMode: 'app', path: 'annual_closings?select=id,fiscal_year,status,closed_at,notes,snapshot_json,created_at,updated_at&order=created_at.desc&limit=1' },
]

export function shouldShowDataHealthDebug() {
  return typeof window !== 'undefined' && window.location.search.includes('debugDataHealth=1')
}

export function extractMissingColumn(detail: string): string | null {
  const match = detail.match(/column\s+([\w.]+)\s+does not exist/i)
  return match?.[1] ?? null
}

export function classifyDataHealthIssue(statusCode: number | null, detail: string): DataHealthProbeResult['issueType'] {
  const normalized = detail.toLowerCase()
  if (normalized.includes('does not exist')) return 'missing_column'
  if (normalized.includes('schema cache')) return 'missing_table'
  if (normalized.includes('permission denied')) return 'permission'
  if (normalized.includes('authentication required') || statusCode === 401) return 'auth'
  return 'other'
}

export async function runDataHealthProbes(
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
  getContext: () => Promise<AuthenticatedReadContext> = getAuthenticatedReadContext,
): Promise<DataHealthProbeResult[]> {
  const { supabaseUrl, supabaseAnonKey, accessToken } = await getContext()

  const results: DataHealthProbeResult[] = []
  for (const probe of dataHealthProbeDefinitions) {
    try {
      const response = await fetchImpl(`${supabaseUrl}/rest/v1/${probe.path}`, {
        method: 'GET',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
        },
      })
      const rawBody = await response.text()
      const detail = response.ok
        ? rawBody.trim()
          ? `OK ${response.status}`
          : `OK ${response.status}`
        : rawBody
      results.push({
        ...probe,
        ok: response.ok,
        statusCode: response.status,
        detail,
        issueType: response.ok ? 'other' : classifyDataHealthIssue(response.status, rawBody),
        missingColumn: response.ok ? null : extractMissingColumn(rawBody),
      })
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Error desconocido ejecutando probe.'
      results.push({
        ...probe,
        ok: false,
        statusCode: null,
        detail,
        issueType: classifyDataHealthIssue(null, detail),
        missingColumn: extractMissingColumn(detail),
      })
    }
  }

  return results
}

export function buildModuleHealthSummaries(domainErrors: Partial<Record<string, string | null>>): ModuleHealthSummary[] {
  const views: AppView[] = [
    'dashboard',
    'alerts',
    'leads',
    'clients',
    'properties',
    'quotes',
    'jobs',
    'invoices',
    'expenses',
    'payments',
    'fiscal_closing',
  ]

  return views.map((view) => {
    const failingDomains = getDomainsForView(view).filter((domain) => {
      const value = domainErrors[domain]
      return typeof value === 'string' && value.trim().length > 0
    })

    return {
      view,
      label: getAppViewLabel(view),
      status: failingDomains.length > 0 ? 'error' : 'ok',
      failingDomains,
    }
  })
}
