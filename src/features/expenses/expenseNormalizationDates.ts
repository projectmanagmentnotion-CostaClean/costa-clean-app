export type DateNormalization = { value: string | null; status: 'VALID' | 'MISSING' | 'AMBIGUOUS' | 'INVALID'; reason?: string }
function validDate(year: number, month: number, day: number): boolean { const date = new Date(Date.UTC(year, month - 1, day)); return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day }
export function normalizeDate(input: unknown): DateNormalization {
  if (input === null || input === undefined || input === '') return { value: null, status: 'MISSING' }
  if (typeof input !== 'string') return { value: null, status: 'INVALID', reason: 'date must be a string' }
  const text = input.trim()
  let year: number, month: number, day: number
  let match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(text)
  if (match) { year = Number(match[1]); month = Number(match[2]); day = Number(match[3]) }
  else {
    match = /^(\d{2})[/-](\d{2})[/-](\d{4})$/u.exec(text)
    if (!match) return { value: null, status: 'INVALID', reason: 'unsupported date format' }
    const first = Number(match[1]); const second = Number(match[2]); year = Number(match[3])
    if (first <= 12 && second <= 12 && first !== second) return { value: null, status: 'AMBIGUOUS', reason: 'day/month order is ambiguous' }
    day = first; month = second
  }
  if (!validDate(year, month, day)) return { value: null, status: 'INVALID', reason: 'calendar date does not exist' }
  return { value: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, status: 'VALID' }
}
