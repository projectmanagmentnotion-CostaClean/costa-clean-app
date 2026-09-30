export type TaxIdValidation = 'VALID' | 'INVALID' | 'UNKNOWN_FORMAT'
export interface TaxIdResult { rawValue: string | null; normalizedValue: string | null; status: TaxIdValidation }
const nifLetters = 'TRWAGMYFPDXBNJZSQVHLCKE'
const control = (digits: string) => nifLetters[Number(digits) % 23]
function nif(value: string): TaxIdValidation { return /^\d{8}[A-Z]$/u.test(value) && control(value.slice(0, 8)) === value[8] ? 'VALID' : 'INVALID' }
function nie(value: string): TaxIdValidation { if (!/^[XYZ]\d{7}[A-Z]$/u.test(value)) return 'INVALID'; return control(`${({ X: '0', Y: '1', Z: '2' } as Record<string, string>)[value[0]]}${value.slice(1, 8)}`) === value[8] ? 'VALID' : 'INVALID' }
function cif(value: string): TaxIdValidation {
  if (!/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/u.test(value)) return 'INVALID'
  const digits = value.slice(1, 8); let sum = 0
  for (let i = 0; i < digits.length; i += 1) { const n = Number(digits[i]); const doubled = i % 2 === 0 ? n * 2 : n; sum += doubled > 9 ? doubled - 9 : doubled }
  const check = (10 - (sum % 10)) % 10; const final = value[8]; return /\d/u.test(final) ? Number(final) === check ? 'VALID' : 'INVALID' : 'JABCDEFGHI'[check] === final ? 'VALID' : 'INVALID'
}
export function normalizeTaxId(input: unknown): TaxIdResult {
  if (input === null || input === undefined || input === '') return { rawValue: null, normalizedValue: null, status: 'UNKNOWN_FORMAT' }
  if (typeof input !== 'string') return { rawValue: null, normalizedValue: null, status: 'UNKNOWN_FORMAT' }
  const normalized = input.replace(/\s+/gu, '').toUpperCase()
  if (/^\d{8}[A-Z]$/u.test(normalized)) return { rawValue: input, normalizedValue: normalized, status: nif(normalized) }
  if (/^[XYZ]\d{7}[A-Z]$/u.test(normalized)) return { rawValue: input, normalizedValue: normalized, status: nie(normalized) }
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/u.test(normalized)) return { rawValue: input, normalizedValue: normalized, status: cif(normalized) }
  return { rawValue: input, normalizedValue: normalized, status: 'UNKNOWN_FORMAT' }
}
