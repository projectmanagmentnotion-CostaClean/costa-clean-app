import { describe, expect, it } from 'vitest'
import { isDateWithinFiscalPeriod, resolveFiscalPeriod, type FiscalPeriodSelection } from './fiscalPeriods'

describe('resolveFiscalPeriod', () => {
  it('resuelve un trimestre con su rango y etiqueta', () => {
    const selection: FiscalPeriodSelection = {
      mode: 'quarter',
      year: 2026,
      month: 1,
      quarter: 2,
      startDate: '',
      endDate: '',
    }

    const period = resolveFiscalPeriod(selection)

    expect(period.label).toBe('T2 2026')
    expect(period.startDate).toBe('2026-04-01')
    expect(period.endDate).toBe('2026-06-30')
  })

  it('evalua correctamente un rango personalizado', () => {
    const period = resolveFiscalPeriod({
      mode: 'custom',
      year: 2026,
      month: 1,
      quarter: 1,
      startDate: '2026-02-10',
      endDate: '2026-02-28',
    })

    expect(isDateWithinFiscalPeriod('2026-02-15', period)).toBe(true)
    expect(isDateWithinFiscalPeriod('2026-03-01', period)).toBe(false)
  })
})
