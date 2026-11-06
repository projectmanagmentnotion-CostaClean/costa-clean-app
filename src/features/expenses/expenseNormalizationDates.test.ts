import { describe, expect, it } from 'vitest'
import { normalizeDate } from './expenseNormalizationDates'
describe('N5.3 dates', () => { it('normalizes ISO and day-first dates', () => { expect(normalizeDate('2026-09-28').value).toBe('2026-09-28'); expect(normalizeDate('28/09/2026').value).toBe('2026-09-28') }); it('fails closed for impossible and ambiguous dates', () => { expect(normalizeDate('31/02/2026').status).toBe('INVALID'); expect(normalizeDate('03/04/2026').status).toBe('AMBIGUOUS'); expect(normalizeDate(null).status).toBe('MISSING') }) })
