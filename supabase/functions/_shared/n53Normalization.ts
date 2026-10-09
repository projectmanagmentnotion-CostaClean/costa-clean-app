import { normalizeExpenseProposal } from '../../../src/features/expenses/expenseNormalization.ts'
import { validateExtractionProposal, type ExtractionProposal } from '../../../src/features/expenses/expenseExtractionContract.ts'

export const NORMALIZER_IMPLEMENTATION_VERSION = 'n5.3-normalizer-v1'

export { normalizeExpenseProposal, validateExtractionProposal }
export type { ExtractionProposal }

export function canonicalSerialize(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('canonical_number_not_finite')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalSerialize).join(',')}]`
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalSerialize(record[key])}`).join(',')}}`
  }
  throw new Error('canonical_value_unsupported')
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function buildNormalizationIdentity(extractionId: string, proposal: ExtractionProposal, schemaVersion: number, normalizerVersion = NORMALIZER_IMPLEMENTATION_VERSION) {
  const inputHash = await sha256Hex(canonicalSerialize(proposal))
  const normalizationKey = await sha256Hex(`n53|${extractionId}|${schemaVersion}|${normalizerVersion}|${inputHash}`)
  return { inputHash, normalizationKey }
}
