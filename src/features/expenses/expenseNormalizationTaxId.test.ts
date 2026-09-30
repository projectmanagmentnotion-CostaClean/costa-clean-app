import { describe, expect, it } from 'vitest'
import { normalizeTaxId } from './expenseNormalizationTaxId'
describe('N5.3 tax identifiers', () => { it('validates NIF/NIE and keeps foreign formats separate', () => { expect(normalizeTaxId('12345678Z').status).toBe('VALID'); expect(normalizeTaxId('X1234567L').status).toBe('VALID'); expect(normalizeTaxId('GB 123').status).toBe('UNKNOWN_FORMAT'); expect(normalizeTaxId('12345678A').status).toBe('INVALID') }) })
