import { getSupabaseClient } from '../../lib/supabase'
import { recordAuditEvent } from '../auditTrail/auditTrailApi'

type JsonRecord = Record<string, unknown>

function getClientOrThrow() {
  const { client, error } = getSupabaseClient()

  if (!client) {
    throw new Error(error ?? 'No se pudo inicializar Supabase.')
  }

  return client
}

export async function saveRecurringInvoicePlan(plan: JsonRecord): Promise<void> {
  const client = getClientOrThrow()
  const { error } = await client.rpc('save_client_recurring_invoice_plan', {
    p_plan: plan,
  })

  if (error) {
    throw new Error(error.message || 'No se pudo guardar la automatizacion recurrente.')
  }

  await recordAuditEvent({
    entityType: 'invoice',
    entityId: String(plan.id ?? ''),
    action: 'upsert',
    changedFields: Object.keys(plan),
    newValues: plan,
    metadata: {
      recurring_plan: true,
      line_count: Array.isArray(plan.template_lines) ? plan.template_lines.length : 0,
    },
  })
}

export interface RecurringInvoiceGenerationResult {
  invoice_id: string
  plan_id: string
  next_issue_date: string
}

export async function generateInvoiceFromRecurringPlan(
  planId: string,
  issueDate?: string | null,
): Promise<RecurringInvoiceGenerationResult> {
  const client = getClientOrThrow()
  const { data, error } = await client.rpc('generate_invoice_from_recurring_plan', {
    p_plan_id: planId,
    p_issue_date: issueDate ?? null,
  })

  if (error) {
    throw new Error(error.message || 'No se pudo emitir la factura recurrente.')
  }

  const result = data as RecurringInvoiceGenerationResult

  await recordAuditEvent({
    entityType: 'invoice',
    entityId: result.invoice_id,
    action: 'upsert',
    changedFields: ['id', 'issue_date'],
    newValues: result as unknown as Record<string, unknown>,
    metadata: {
      recurring_plan: true,
      plan_id: result.plan_id,
      next_issue_date: result.next_issue_date,
    },
  })

  return result
}
