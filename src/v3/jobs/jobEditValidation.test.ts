import { describe, expect, it } from 'vitest'
import { createBlankBillingLine } from '../../features/shared/billingLineDrafts'
import { validateJobEditStep } from './jobEditValidation'

describe('V3 job edit step validation', () => {
  it('requires a service date before leaving the schedule step', () => {
    expect(validateJobEditStep(0, { scheduled_date: '', line: createBlankBillingLine() }))
      .toBe('Debes indicar la fecha del servicio.')
  })

  it('requires a valid billing line before leaving the billing step', () => {
    expect(validateJobEditStep(1, { scheduled_date: '2026-11-04', line: createBlankBillingLine() }))
      .toBe('Completa concepto, cantidad y precio unitario.')
  })

  it('allows valid schedule and billing steps', () => {
    const line = { ...createBlankBillingLine(), concept: 'Limpieza', quantity: '1', unit: 'servicio', unit_price: '125' }
    expect(validateJobEditStep(0, { scheduled_date: '2026-11-04', line })).toBeNull()
    expect(validateJobEditStep(1, { scheduled_date: '2026-11-04', line })).toBeNull()
    expect(validateJobEditStep(2, { scheduled_date: '2026-11-04', line })).toBeNull()
  })
})
