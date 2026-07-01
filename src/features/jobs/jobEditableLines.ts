import { getServiceTypeLabel } from '../../app/displayFormat'
import { normalizeLineConcept } from '../quotes/lineConcepts'
import {
  createBlankBillingLine,
  createLocalId,
  formatMoneyInput,
  formatQuantityInput,
  roundMoney,
  type BillingLineFormState,
} from '../shared/billingLineDrafts'
import type { JobBillingLineItem, JobListItem } from './types'

export function getPersistedJobLines(job: JobListItem | null): JobBillingLineItem[] {
  if (!job) {
    return []
  }

  const rawCandidates = [job.billing_lines, job.billingLines, job.job_lines]
  const nonEmptyCandidate = rawCandidates.find((candidate) => Array.isArray(candidate) && candidate.length > 0)
  if (nonEmptyCandidate) {
    return nonEmptyCandidate
  }

  const emptyCandidate = rawCandidates.find(Array.isArray)
  return emptyCandidate ?? []
}

function normalizeEditableJobLine(line: JobBillingLineItem): JobBillingLineItem | null {
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
      : roundMoney(quantity * unitPrice),
  }
}

export function normalizeEditableJobLines(lines: JobBillingLineItem[] | null | undefined): JobBillingLineItem[] {
  if (!lines?.length) {
    return []
  }

  return [...lines]
    .map(normalizeEditableJobLine)
    .filter((line): line is JobBillingLineItem => Boolean(line))
    .sort((left, right) => Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0))
}

export function buildLegacyEditableLine(job: Pick<JobListItem, 'billing_concept' | 'billing_quantity' | 'billing_unit' | 'billing_unit_price' | 'service_type'> | null): BillingLineFormState[] {
  if (!job) {
    return [createBlankBillingLine({ unit_price: '0.00' })]
  }

  const quantity = Number(job.billing_quantity)
  const unitPrice = Number(job.billing_unit_price)

  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice) || quantity <= 0 || unitPrice < 0) {
    return [createBlankBillingLine({
      concept: getServiceTypeLabel(job.service_type),
      unit_price: '0.00',
    })]
  }

  return [createBlankBillingLine({
    concept: normalizeLineConcept(job.billing_concept, getServiceTypeLabel(job.service_type)),
    quantity: formatQuantityInput(quantity),
    unit: job.billing_unit?.trim() || 'servicio',
    unit_price: formatMoneyInput(unitPrice),
  })]
}

export function buildEditableJobLinesFromJob(job: JobListItem | null): BillingLineFormState[] {
  if (!job) {
    return buildLegacyEditableLine(null)
  }

  const normalizedLines = normalizeEditableJobLines(getPersistedJobLines(job))
  if (normalizedLines.length > 0) {
    return normalizedLines.map((line) => ({
      local_id: line.id || createLocalId('LINE-DRAFT'),
      concept: normalizeLineConcept(line.concept),
      quantity: formatQuantityInput(line.quantity),
      unit: line.unit || 'servicio',
      unit_price: formatMoneyInput(line.unit_price),
    }))
  }

  return buildLegacyEditableLine(job)
}
