import { getServiceTypeLabel } from '../../app/displayFormat'
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

function buildBillingLine(job: JobListItem): InvoiceCreatePrefillLine | null {
  const quantity = Number(job.billing_quantity)
  const unitPrice = Number(job.billing_unit_price)

  if (
    !Number.isFinite(quantity) ||
    !Number.isFinite(unitPrice) ||
    quantity <= 0 ||
    unitPrice < 0
  ) {
    return null
  }

  return {
    concept: simplifyLineConcept(job.billing_concept || getServiceTypeLabel(job.service_type)),
    quantity: formatDecimalInput(quantity),
    unit: normalizeBillingUnit(job.billing_unit),
    unit_price: formatDecimalInput(unitPrice),
  }
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

  const billingLine = buildBillingLine(job)

  return {
    request_id: createPrefillId(),
    origin_kind: 'job',
    job_id: job.id,
    quote_id: job.quote_id ?? '',
    client_id: job.client_id,
    property_id: job.property_id,
    notes: buildInvoiceNotes(job),
    lines: billingLine ? [billingLine] : [],
    title: job.display_code ?? job.id,
  }
}
