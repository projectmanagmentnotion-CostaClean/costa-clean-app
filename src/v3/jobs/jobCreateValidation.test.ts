import { describe, expect, it, vi } from 'vitest'
import { createBlankBillingLine } from '../../features/shared/billingLineDrafts'
import {
  getStableJobSubmissionId,
  getV3JobCreateStepError,
  isValidScheduledDate,
  type V3JobCreateFormSnapshot,
} from './jobCreateValidation'

const validForm: V3JobCreateFormSnapshot = {
  client_id: 'client-test',
  property_id: 'property-test',
  scheduled_date: '2026-11-11',
  service_type: 'standard_cleaning',
}

describe('V3 job create validation', () => {
  it('requires a service date and accepts a valid ISO calendar date', () => {
    expect(getV3JobCreateStepError(1, { ...validForm, scheduled_date: '' }, [])).toBe('Indica la fecha del servicio.')
    expect(getV3JobCreateStepError(1, validForm, [])).toBeNull()
  })

  it('rejects malformed and impossible calendar dates without timezone conversion', () => {
    expect(isValidScheduledDate('11/11/2026')).toBe(false)
    expect(isValidScheduledDate('2026-02-29')).toBe(false)
    expect(isValidScheduledDate('2024-02-29')).toBe(true)
    expect(isValidScheduledDate('2026-11-11')).toBe(true)
  })

  it('validates a billable line before persistence', () => {
    const line = createBlankBillingLine({ concept: 'Servicio de prueba', quantity: '1', unit: 'servicio', unit_price: '10' })
    expect(getV3JobCreateStepError(2, validForm, [line])).toBeNull()
    expect(getV3JobCreateStepError(2, validForm, [createBlankBillingLine()])).toBe('Añade una línea de cobro válida.')
  })

  it('reuses the same service ID across retries after an ambiguous save response', () => {
    const createId = vi.fn(() => 'JOB-stable-test-id')
    const firstAttemptId = getStableJobSubmissionId(null, createId)
    const retryId = getStableJobSubmissionId(firstAttemptId, createId)

    expect(firstAttemptId).toBe('JOB-stable-test-id')
    expect(retryId).toBe(firstAttemptId)
    expect(createId).toHaveBeenCalledOnce()
  })
})
