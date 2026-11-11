import { buildBillingLinePayloads, type BillingLineFormState } from '../../features/shared/billingLineDrafts'

export interface V3JobCreateFormSnapshot {
  client_id: string
  property_id: string
  scheduled_date: string
  service_type: string
}

export function isValidScheduledDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || month < 1 || month > 12 || day < 1) return false

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= daysInMonth[month - 1]
}

export function getV3JobCreateStepError(
  step: number,
  form: V3JobCreateFormSnapshot,
  lines: BillingLineFormState[],
): string | null {
  if (step === 0) {
    if (!form.client_id || !form.property_id) return 'Completa cliente e inmueble.'
  }

  if (step === 1) {
    if (!form.scheduled_date) return 'Indica la fecha del servicio.'
    if (!isValidScheduledDate(form.scheduled_date)) return 'Indica una fecha válida para el servicio.'
    if (!form.service_type) return 'Indica el tipo de servicio.'
  }

  if (step === 2 && !buildBillingLinePayloads(lines, (value) => value.trim())?.length) {
    return 'Añade una línea de cobro válida.'
  }

  return null
}

export function getStableJobSubmissionId(
  currentId: string | null,
  createId: () => string,
): string {
  return currentId ?? createId()
}
