import { getServiceTypeLabel } from '../../app/displayFormat'
import { getJobBillingLines } from '../jobs/jobBilling'
import type { JobListItem } from '../jobs/types'
import { simplifyLineConcept } from '../quotes/lineConcepts'

export interface InvoiceCreatePrefillLine {
  concept: string
  quantity: string
  unit: string
  unit_price: string
}

export interface InvoiceCreatePrefill {
  request_id: string
  origin_kind: 'job' | 'quote' | 'manual' | 'recurring'
  job_id: string
  quote_id: string
  client_id: string
  property_id: string
  notes: string
  lines: InvoiceCreatePrefillLine[]
  title?: string
}

function createPrefillId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `invoice-prefill-${Date.now()}`
}

function normalizeBillingUnit(value: string | null | undefined): string {
  return value === 'service' ? 'servicio' : value?.trim() || 'servicio'
}

function formatDecimalInput(value: number): string {
  return value.toFixed(2)
}

function buildBillingLines(job: JobListItem): InvoiceCreatePrefillLine[] {
  return getJobBillingLines(job).map((line) => ({
    concept: line.concept || simplifyLineConcept(job.billing_concept || getServiceTypeLabel(job.service_type)),
    quantity: formatDecimalInput(line.quantity),
    unit: normalizeBillingUnit(line.unit),
    unit_price: formatDecimalInput(line.unit_price),
  }))
}

function buildInvoiceNotes(job: JobListItem): string {
  if (!job.quote_id) return job.notes?.trim() ?? ''

  return [
    'Servicio realizado segun presupuesto aprobado.',
    'Condiciones economicas aplicadas segun presupuesto aceptado.',
    'Precios sin IVA.',
  ].join('\n')
}

export function buildInvoiceCreatePrefillFromJob(job: JobListItem): InvoiceCreatePrefill | null {
  if (!job.id || !job.client_id) {
    return null
  }

  const billingLines = buildBillingLines(job)

  return {
    request_id: createPrefillId(),
    origin_kind: 'job',
    job_id: job.id,
    quote_id: job.quote_id ?? '',
    client_id: job.client_id,
    property_id: job.property_id,
    notes: buildInvoiceNotes(job),
    lines: billingLines,
    title: job.display_code ?? job.id,
  }
}
