import {
  calculateBillingSubtotal,
  createBlankBillingLine,
  parseDecimalInput,
  roundMoney,
  type BillingLineFormState,
} from '../shared/billingLineDrafts'
import type { JobBillingLineItem, JobListItem } from './types'

export interface JobEditorValidationResult {
  blockingMessage: string | null
  globalWarnings: string[]
  lineWarnings: Record<string, string[]>
}

export interface JobEditorRefreshResult {
  job: JobListItem
  status: 'synced' | 'refresh_warning'
  message: string
}

export interface JobEditorSaveFormSnapshot {
  client_id: string
  property_id: string
  quote_id: string
  scheduled_date: string
  status: string
  service_type: string
  notes: string
}

function normalizeJobLineSnapshot(lines: JobBillingLineItem[] | null | undefined) {
  return (lines ?? []).map((line, index) => ({
    sort_order: line.sort_order ?? index + 1,
    concept: line.concept.trim(),
    quantity: roundMoney(Number(line.quantity ?? 0)),
    unit: (line.unit ?? 'servicio').trim() || 'servicio',
    unit_price: roundMoney(Number(line.unit_price ?? 0)),
    line_subtotal: roundMoney(Number(line.line_subtotal ?? 0)),
  }))
}

function buildComparableJobSnapshot(job: JobListItem) {
  return JSON.stringify({
    client_id: job.client_id,
    property_id: job.property_id,
    quote_id: job.quote_id ?? null,
    scheduled_date: job.scheduled_date,
    status: job.status,
    service_type: job.service_type,
    billing_concept: job.billing_concept?.trim() ?? '',
    billing_quantity: roundMoney(Number(job.billing_quantity ?? 0)),
    billing_unit: (job.billing_unit ?? 'servicio').trim() || 'servicio',
    billing_unit_price: roundMoney(Number(job.billing_unit_price ?? 0)),
    notes: job.notes?.trim() ?? '',
    billing_lines: normalizeJobLineSnapshot(job.billing_lines ?? job.billingLines ?? job.job_lines),
  })
}

export function appendBillingLine(lines: BillingLineFormState[]) {
  return [...lines, createBlankBillingLine()]
}

export function shouldShowJobLineDebug(search: string, isDev: boolean) {
  return isDev || search.includes('debugJobLines=1')
}

export function buildJobEditorValidation(
  lines: BillingLineFormState[],
  form: Pick<JobEditorSaveFormSnapshot, 'client_id' | 'property_id' | 'scheduled_date'>,
): JobEditorValidationResult {
  const lineWarnings: Record<string, string[]> = {}

  if (!form.client_id) {
    return {
      blockingMessage: 'Debes seleccionar un cliente.',
      globalWarnings: [],
      lineWarnings,
    }
  }

  if (!form.property_id) {
    return {
      blockingMessage: 'Debes seleccionar una propiedad.',
      globalWarnings: [],
      lineWarnings,
    }
  }

  if (!form.scheduled_date) {
    return {
      blockingMessage: 'Debes indicar la fecha programada.',
      globalWarnings: [],
      lineWarnings,
    }
  }

  let hasInvalidLine = false
  for (const line of lines) {
    const warnings: string[] = []
    const concept = line.concept.trim()
    const quantity = parseDecimalInput(line.quantity)
    const unitPrice = parseDecimalInput(line.unit_price)

    if (!concept) warnings.push('Falta el concepto.')
    if (!Number.isFinite(quantity) || quantity <= 0) warnings.push('La cantidad debe ser mayor que 0.')
    if (!Number.isFinite(unitPrice)) warnings.push('El precio unitario no es valido.')
    if (Number.isFinite(unitPrice) && unitPrice < 0) warnings.push('El precio unitario no puede ser negativo.')

    if (warnings.length > 0) {
      lineWarnings[line.local_id] = warnings
      hasInvalidLine = true
    }
  }

  const globalWarnings: string[] = []
  if (lines.length > 0 && calculateBillingSubtotal(lines) <= 0) {
    globalWarnings.push('El subtotal del servicio es 0 EUR. Revisa si falta precio en alguna linea.')
  }

  return {
    blockingMessage: hasInvalidLine
      ? 'Cada linea debe tener concepto, cantidad mayor que 0 y precio unitario valido.'
      : null,
    globalWarnings,
    lineWarnings,
  }
}

export function buildOptimisticJobAfterSave({
  job,
  form,
  lines,
  billingSummary,
}: {
  job: JobListItem
  form: JobEditorSaveFormSnapshot
  lines: JobBillingLineItem[]
  billingSummary: {
    billing_concept: string
    billing_quantity: number
    billing_unit: string
    billing_unit_price: number
  }
}) {
  return {
    ...job,
    client_id: form.client_id,
    property_id: form.property_id,
    quote_id: form.quote_id || null,
    scheduled_date: form.scheduled_date,
    status: form.status,
    service_type: form.service_type,
    billing_concept: billingSummary.billing_concept,
    billing_quantity: billingSummary.billing_quantity,
    billing_unit: billingSummary.billing_unit,
    billing_unit_price: billingSummary.billing_unit_price,
    billing_lines: lines,
    billingLines: lines,
    job_lines: lines,
    notes: form.notes.trim() || null,
  } satisfies JobListItem
}

export function resolveJobAfterRefresh({
  optimisticJob,
  remoteJob,
}: {
  optimisticJob: JobListItem
  remoteJob: JobListItem | null | undefined
}): JobEditorRefreshResult {
  if (!remoteJob || remoteJob.id !== optimisticJob.id) {
    return {
      job: optimisticJob,
      status: 'refresh_warning',
      message: 'Guardado correcto. La vista mantiene el estado local mientras llega el refresco.',
    }
  }

  if (buildComparableJobSnapshot(remoteJob) !== buildComparableJobSnapshot(optimisticJob)) {
    return {
      job: optimisticJob,
      status: 'refresh_warning',
      message: 'Guardado correcto, pero el refresco aun no devolvio las lineas nuevas. Se mantiene la version local.',
    }
  }

  return {
    job: remoteJob,
    status: 'synced',
    message: 'Servicio guardado y refrescado correctamente.',
  }
}
