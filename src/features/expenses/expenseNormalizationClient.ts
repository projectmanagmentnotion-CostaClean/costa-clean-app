import { FunctionsHttpError } from '@supabase/supabase-js'
import { getSupabaseClient } from '../../lib/supabase'
import type { NormalizedExpenseProposal } from './expenseNormalizationContract'

export type ExpenseNormalizationResult =
  | { ok: true; normalizationId: string; extractionId: string; attempt: number; status: 'SUCCEEDED'; reviewStatus: string; reconciliationStatus: string; normalizedProposal: NormalizedExpenseProposal; reused: boolean }
  | { ok: false; errorCode: string; errorMessageSafe: string }

export interface ExpenseNormalizationClient {
  requestNormalization(extractionId: string): Promise<ExpenseNormalizationResult>
}

const runtimeNotConfigured = (): ExpenseNormalizationResult => ({ ok: false, errorCode: 'NORMALIZATION_RUNTIME_NOT_CONFIGURED', errorMessageSafe: 'La normalización no está configurada en este entorno.' })
const invalidResponse = (): ExpenseNormalizationResult => ({ ok: false, errorCode: 'INVALID_NORMALIZATION_RESPONSE', errorMessageSafe: 'La respuesta de normalización no es válida.' })
const runtimeFailure = (): ExpenseNormalizationResult => ({ ok: false, errorCode: 'NORMALIZATION_FAILED', errorMessageSafe: 'No se pudo completar la normalización.' })

function safeError(value: unknown): ExpenseNormalizationResult | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  return typeof record.errorCode === 'string' && typeof record.errorMessageSafe === 'string'
    ? { ok: false, errorCode: record.errorCode, errorMessageSafe: record.errorMessageSafe }
    : null
}

function parseSuccess(value: unknown): ExpenseNormalizationResult | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (record.ok !== true || typeof record.normalizationId !== 'string' || typeof record.extractionId !== 'string' || typeof record.attempt !== 'number' || !Number.isInteger(record.attempt) || record.status !== 'SUCCEEDED' || !record.normalizedProposal || typeof record.normalizedProposal !== 'object' || typeof record.reviewStatus !== 'string' || typeof record.reconciliationStatus !== 'string' || typeof record.reused !== 'boolean') return null
  return {
    ok: true,
    normalizationId: record.normalizationId,
    extractionId: record.extractionId,
    attempt: record.attempt,
    status: 'SUCCEEDED',
    reviewStatus: record.reviewStatus,
    reconciliationStatus: record.reconciliationStatus,
    normalizedProposal: record.normalizedProposal as NormalizedExpenseProposal,
    reused: record.reused,
  }
}

async function parseInvocationError(error: unknown): Promise<ExpenseNormalizationResult> {
  if (!(error instanceof FunctionsHttpError)) return runtimeFailure()
  try {
    return safeError(await error.context.json()) ?? runtimeFailure()
  } catch {
    return runtimeFailure()
  }
}

/** Browser-safe authenticated boundary to the provider-independent normalizer Edge Function. */
export function createExpenseNormalizationClient(): ExpenseNormalizationClient {
  return {
    async requestNormalization(extractionId) {
      const { client, error } = getSupabaseClient()
      if (error || !client) return runtimeNotConfigured()
      try {
        const { data, error: invokeError } = await client.functions.invoke('expense-document-normalization', { body: { extractionId } })
        const safe = safeError(data)
        if (safe) return safe
        if (invokeError) return parseInvocationError(invokeError)
        return parseSuccess(data) ?? invalidResponse()
      } catch {
        return runtimeFailure()
      }
    },
  }
}
