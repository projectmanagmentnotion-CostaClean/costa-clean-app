import { buildBillingLinePayloads, type BillingLineFormState } from '../../features/shared/billingLineDrafts'

export interface JobEditValidationInput {
  scheduled_date: string
  line: BillingLineFormState
}

export function validateJobEditStep(stepIndex: number, edit: JobEditValidationInput): string | null {
  if (stepIndex === 0 && !edit.scheduled_date.trim()) return 'Debes indicar la fecha del servicio.'
  if (stepIndex === 1 && !buildBillingLinePayloads([edit.line], (concept) => concept.trim())) {
    return 'Completa concepto, cantidad y precio unitario.'
  }
  return null
}
