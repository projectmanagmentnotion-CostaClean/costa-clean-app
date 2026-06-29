import { getSupabaseClient } from '../../lib/supabase'
import type { JobBillingLineItem } from './types'

type JsonPayload = object

function getClientOrThrow() {
  const { client, error } = getSupabaseClient()

  if (!client) {
    throw new Error(error ?? 'No se pudo inicializar Supabase.')
  }

  return client
}

export async function saveJobWithLines(
  job: JsonPayload,
  lines: JsonPayload[],
): Promise<void> {
  const client = getClientOrThrow()
  const { error } = await client.rpc('save_job_with_lines', {
    p_job: job,
    p_lines: lines,
  })

  if (error) {
    throw new Error(error.message || 'No se pudo guardar el servicio y sus lineas.')
  }
}

export function buildJobBillingSummary(lines: JobBillingLineItem[], fallbackConcept: string) {
  if (lines.length === 1) {
    return {
      billing_concept: lines[0].concept,
      billing_quantity: lines[0].quantity,
      billing_unit: lines[0].unit,
      billing_unit_price: lines[0].unit_price,
    }
  }

  const subtotal = lines.reduce((sum, line) => sum + line.line_subtotal, 0)
  const firstConcept = lines[0]?.concept || fallbackConcept

  return {
    billing_concept: `${firstConcept} (+${lines.length - 1} linea(s))`,
    billing_quantity: 1,
    billing_unit: 'servicio',
    billing_unit_price: Math.round((subtotal + Number.EPSILON) * 100) / 100,
  }
}

export function buildJobLinePayloads(lines: JobBillingLineItem[], jobId: string) {
  return lines.map((line, index) => ({
    id: line.id ?? `JOB-LINE-${jobId}-${index + 1}`,
    job_id: jobId,
    sort_order: line.sort_order ?? index + 1,
    concept: line.concept,
    quantity: line.quantity,
    unit: line.unit,
    unit_price: line.unit_price,
    line_subtotal: line.line_subtotal,
  }))
}
