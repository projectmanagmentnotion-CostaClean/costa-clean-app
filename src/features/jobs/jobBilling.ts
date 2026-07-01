import { getServiceTypeLabel } from '../../app/displayFormat'
import { normalizeLineConcept } from '../quotes/lineConcepts'
import { createLocalId, formatQuantityInput } from '../shared/billingLineDrafts'
import { buildEditableJobLinesFromJob, normalizeEditableJobLines } from './jobEditableLines'
import type { JobBillingLineItem, JobListItem } from './types'

export function getJobBillingLines(job: JobListItem | null): JobBillingLineItem[] {
  if (!job) return []

  if (job.billing_lines?.length) {
    return normalizeEditableJobLines(job.billing_lines)
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

export function getJobBillingDraftLines(job: JobListItem | null) {
  return buildEditableJobLinesFromJob(job)
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
