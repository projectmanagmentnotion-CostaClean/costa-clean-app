import { getServiceTypeLabel } from '../../app/displayFormat'
import { normalizeLineConcept } from '../quotes/lineConcepts'
import {
  createBlankBillingLine,
  createLocalId,
  formatMoneyInput,
  formatQuantityInput,
  type BillingLineFormState,
} from '../shared/billingLineDrafts'
import type { JobBillingLineItem, JobListItem } from './types'

function normalizeJobBillingLine(line: JobBillingLineItem): JobBillingLineItem | null {
  const quantity = Number(line.quantity)
  const unitPrice = Number(line.unit_price)
  const lineSubtotal = Number(line.line_subtotal)

  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
    return null
  }

  return {
    ...line,
    sort_order: line.sort_order === undefined ? undefined : Number(line.sort_order),
    quantity,
    unit_price: unitPrice,
    line_subtotal: Number.isFinite(lineSubtotal)
      ? lineSubtotal
      : Math.round((quantity * unitPrice + Number.EPSILON) * 100) / 100,
  }
}

export function getJobBillingLines(job: JobListItem | null): JobBillingLineItem[] {
  if (!job) return []

  if (job.billing_lines?.length) {
    return [...job.billing_lines]
      .map(normalizeJobBillingLine)
      .filter((line): line is JobBillingLineItem => Boolean(line))
      .sort((left, right) => Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0))
  }

  const quantity = Number(job.billing_quantity)
  const unitPrice = Number(job.billing_unit_price)

  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice) || quantity <= 0 || unitPrice < 0) {
    return []
  }

  return [{
    id: createLocalId('JOB-LINE-FALLBACK'),
    sort_order: 1,
    concept: normalizeLineConcept(job.billing_concept, getServiceTypeLabel(job.service_type)),
    quantity,
    unit: job.billing_unit?.trim() || 'servicio',
    unit_price: unitPrice,
    line_subtotal: Math.round((quantity * unitPrice + Number.EPSILON) * 100) / 100,
  }]
}

export function getJobBillingDraftLines(job: JobListItem | null): BillingLineFormState[] {
  const lines = getJobBillingLines(job)
  if (lines.length === 0) {
    return [createBlankBillingLine({ concept: job ? getServiceTypeLabel(job.service_type) : '', unit_price: job ? '0.00' : '0.00' })]
  }

  return lines.map((line) => ({
    local_id: line.id || createLocalId('LINE-DRAFT'),
    concept: normalizeLineConcept(line.concept),
    quantity: formatQuantityInput(line.quantity),
    unit: line.unit || 'servicio',
    unit_price: formatMoneyInput(line.unit_price),
  }))
}

export function getJobBillingDisplayConcept(job: JobListItem): string {
  const lines = getJobBillingLines(job)
  if (lines.length === 0) {
    return job.billing_concept?.trim() || getServiceTypeLabel(job.service_type)
  }

  return lines[0].concept
}

export function getJobBillingDisplaySummary(job: JobListItem): string {
  const lines = getJobBillingLines(job)
  if (lines.length === 0) return 'Sin base de facturacion'
  if (lines.length === 1) return `${formatQuantityInput(lines[0].quantity)} ${lines[0].unit}`
  return `${lines.length} linea(s)`
}
