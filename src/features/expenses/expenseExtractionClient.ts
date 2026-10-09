import { getSupabaseClient } from '../../lib/supabase'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { validateExtractionProposal, type ExtractionErrorCode, type ExtractionProviderInput, type ExtractionProviderResult } from './expenseExtractionContract'

export interface ExpenseExtractionClient {
  requestExtraction(input: ExtractionProviderInput, mode?: 'extract' | 'retry'): Promise<ExtractionProviderResult>
}

const runtimeNotConfigured = (): ExtractionProviderResult => ({
  ok: false,
  errorCode: 'EXTRACTION_RUNTIME_NOT_CONFIGURED',
  errorMessageSafe: 'La extracción documental no está configurada en este entorno.',
  metadata: null,
})

const invalidProviderResponse = (): ExtractionProviderResult => ({
  ok: false,
  errorCode: 'INVALID_PROVIDER_RESPONSE',
  errorMessageSafe: 'La respuesta de extracción no es válida.',
  metadata: null,
})

const safeRuntimeFailure = (): ExtractionProviderResult => ({
  ok: false,
  errorCode: 'EXTRACTION_FAILED',
  errorMessageSafe: 'No se pudo completar la extracción documental.',
  metadata: null,
})

function readSafeError(value: unknown): ExtractionProviderResult | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const errorCode = record.errorCode
  const errorMessageSafe = record.errorMessageSafe
  if (typeof errorCode !== 'string' || typeof errorMessageSafe !== 'string') return null
  const allowedCodes: ExtractionErrorCode[] = [
    'UNSUPPORTED_DOCUMENT',
    'EXTRACTION_RUNTIME_NOT_CONFIGURED',
    'EXTRACTION_PROVIDER_UNAVAILABLE',
    'EXTRACTION_TIMEOUT',
    'EXTRACTION_RATE_LIMITED',
    'EXTRACTION_REFUSED',
    'DOCUMENT_INVALID',
    'INVALID_PROVIDER_RESPONSE',
    'DOCUMENT_NOT_FOUND',
    'DOCUMENT_ACCESS_DENIED',
    'EXTRACTION_FAILED',
  ]
  if (!allowedCodes.includes(errorCode as ExtractionErrorCode)) return null
  return { ok: false, errorCode: errorCode as ExtractionErrorCode, errorMessageSafe, metadata: null }
}

function parseSuccess(value: unknown): ExtractionProviderResult | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (record.ok !== true || typeof record.extractionId !== 'string' || typeof record.attempt !== 'number' || !Number.isInteger(record.attempt) || typeof record.metadata !== 'object' || record.metadata === null) return null
  const metadata = record.metadata as Record<string, unknown>
  if (typeof metadata.provider !== 'string' || typeof metadata.providerVersion !== 'string' || (metadata.model !== null && typeof metadata.model !== 'string')) return null
  const checked = validateExtractionProposal(record.proposal)
  if (!checked.ok) return invalidProviderResponse()
  return { ok: true, extractionId: record.extractionId, attempt: record.attempt, proposal: checked.proposal, metadata: { provider: metadata.provider, providerVersion: metadata.providerVersion, model: metadata.model as string | null } }
}

async function parseInvocationError(error: unknown): Promise<ExtractionProviderResult> {
  if (!(error instanceof FunctionsHttpError)) return safeRuntimeFailure()
  try {
    const payload = await error.context.json()
    return readSafeError(payload) ?? safeRuntimeFailure()
  } catch {
    return safeRuntimeFailure()
  }
}

/** Browser-safe authenticated boundary to a deployed Edge Function. */
function createExpenseExtractionClientForFunction(functionName: string): ExpenseExtractionClient {
  return {
    async requestExtraction(input, mode = 'extract') {
      const { client, error } = getSupabaseClient()
      if (error || !client) return runtimeNotConfigured()
      try {
        const { data, error: invokeError } = await client.functions.invoke(functionName, {
          body: { captureDocumentId: input.captureDocumentId, mode },
        })
        const safeError = readSafeError(data)
        if (safeError) return safeError
        if (invokeError) return parseInvocationError(invokeError)
        return parseSuccess(data) ?? invalidProviderResponse()
      } catch {
        return safeRuntimeFailure()
      }
    },
  }
}

/** Existing deterministic fixture boundary. Keep this as the default until the QA secret gate is approved. */
export function createExpenseExtractionClient(): ExpenseExtractionClient {
  return createExpenseExtractionClientForFunction('expense-document-extraction')
}

/** Dedicated authenticated OpenAI boundary; it never sends provider credentials from the browser. */
export function createOpenAiExpenseExtractionClient(): ExpenseExtractionClient {
  return createExpenseExtractionClientForFunction('expense-document-openai-extraction')
}
