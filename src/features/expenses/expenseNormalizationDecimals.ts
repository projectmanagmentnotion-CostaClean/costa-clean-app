export type DecimalNormalization = { value: string | null; status: 'VALID' | 'MISSING' | 'AMBIGUOUS' | 'INVALID'; reason?: string }
type Parts = { sign: bigint; digits: string; scale: number }

function parseCanonical(value: string): Parts | null {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/u.exec(value)
  if (!match) return null
  const fraction = match[3] ?? ''
  return { sign: match[1] === '-' ? -1n : 1n, digits: (match[2] + fraction).replace(/^0+(?=\d)/u, ''), scale: fraction.length }
}
function parts(value: string): Parts {
  const parsed = parseCanonical(value)
  if (!parsed) throw new Error('INVALID_DECIMAL')
  return parsed
}
function format(p: Parts): string {
  const digits = p.digits || '0'
  const scale = Math.max(2, p.scale)
  const scaledDigits = digits + '0'.repeat(scale - p.scale)
  const padded = scaledDigits.padStart(scale + 1, '0')
  const whole = padded.slice(0, -scale) || '0'
  const fraction = padded.slice(-scale)
  const trimmedWhole = whole.replace(/^0+(?=\d)/u, '')
  const result = `${trimmedWhole}.${fraction}`
  return p.sign < 0n && result !== '0.00' && /[1-9]/u.test(result) ? `-${result}` : result
}

export function normalizeDecimal(input: unknown): DecimalNormalization {
  if (input === null || input === undefined || input === '') return { value: null, status: 'MISSING' }
  if (typeof input !== 'string') return { value: null, status: 'INVALID', reason: 'decimal must be a string' }
  const text = input.trim().replace(/\s+/gu, '')
  if (!text || !/^-?[\d.,]+$/u.test(text)) return { value: null, status: 'INVALID', reason: 'invalid decimal characters' }
  const sign = text.startsWith('-') ? '-' : ''
  const body = text.replace(/^-/, '')
  const commas = (body.match(/,/gu) ?? []).length
  const dots = (body.match(/\./gu) ?? []).length
  let canonical = body
  if (commas && dots) {
    const decimal = body.lastIndexOf(',') > body.lastIndexOf('.') ? ',' : '.'
    const thousands = decimal === ',' ? '.' : ','
    const decimalIndex = body.lastIndexOf(decimal)
    if (!/^\d+$/u.test(body.slice(0, decimalIndex).replaceAll(thousands, '')) || !/^\d+$/u.test(body.slice(decimalIndex + 1))) return { value: null, status: 'INVALID', reason: 'malformed separators' }
    canonical = `${body.slice(0, decimalIndex).replaceAll(thousands, '')}.${body.slice(decimalIndex + 1)}`
  } else if (commas || dots) {
    const separator = commas ? ',' : '.'
    const count = body.split(separator).length - 1
    if (count > 1) {
      const groups = body.split(separator)
      if (!groups.every((group, index) => index === 0 ? /^\d+$/u.test(group) : /^\d{3}$/u.test(group))) return { value: null, status: 'INVALID', reason: 'malformed grouped number' }
      canonical = groups.join('')
    } else {
      const [whole, fraction] = body.split(separator)
      if (!/^\d+$/u.test(whole) || !/^\d+$/u.test(fraction)) return { value: null, status: 'INVALID', reason: 'malformed decimal' }
      if (fraction.length === 3) return { value: null, status: 'AMBIGUOUS', reason: 'single separator with three fractional digits' }
      canonical = `${whole}.${fraction}`
    }
  }
  const parsed = parseCanonical(`${sign}${canonical}`)
  if (!parsed) return { value: null, status: 'INVALID', reason: 'invalid decimal' }
  return { value: format(parsed), status: 'VALID' }
}

function align(a: Parts, b: Parts): [bigint, bigint, number] {
  const scale = Math.max(a.scale, b.scale)
  const factorA = 10n ** BigInt(scale - a.scale)
  const factorB = 10n ** BigInt(scale - b.scale)
  return [a.sign * BigInt(a.digits) * factorA, b.sign * BigInt(b.digits) * factorB, scale]
}
function arithmetic(a: string, b: string, operation: (x: bigint, y: bigint) => bigint): string {
  const [left, right, scale] = align(parts(a), parts(b))
  const result = operation(left, right)
  const negative = result < 0n
  const absolute = negative ? -result : result
  const digits = absolute.toString().padStart(scale + 1, '0')
  return format({ sign: negative ? -1n : 1n, digits, scale })
}
export function decimalAdd(a: string, b: string): string { return arithmetic(a, b, (x, y) => x + y) }
export function decimalSubtract(a: string, b: string): string { return arithmetic(a, b, (x, y) => x - y) }
export function decimalCompare(a: string, b: string): -1 | 0 | 1 { const [left, right] = align(parts(a), parts(b)); return left < right ? -1 : left > right ? 1 : 0 }
export function decimalAbsDifference(a: string, b: string): string { return arithmetic(a, b, (x, y) => x >= y ? x - y : y - x) }
export function decimalPercent(base: string, rate: string): string {
  const left = parts(base)
  const right = parts(rate)
  return format({ sign: left.sign * right.sign, digits: (BigInt(left.digits) * BigInt(right.digits)).toString(), scale: left.scale + right.scale + 2 })
}
