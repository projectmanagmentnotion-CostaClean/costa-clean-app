import { validateExtractionProposal } from './expenseExtractionContract'
import { createFixtureExtractionProvider, type DocumentExtractionProvider } from './expenseExtractionProvider'
import type { ExtractionProviderInput, ExtractionProviderResult } from './expenseExtractionContract'
import type { ExpenseExtractionClient } from './expenseExtractionClient'

export function validateProviderResult(result: ExtractionProviderResult): ExtractionProviderResult {
  if (!result.ok) return result
  const checked = validateExtractionProposal(result.proposal)
  if (!checked.ok) return { ok: false, errorCode: 'INVALID_PROVIDER_RESPONSE', errorMessageSafe: 'La respuesta del proveedor no es válida.', metadata: result.metadata }
  return { ...result, proposal: checked.proposal }
}

function safeProviderCall(provider: DocumentExtractionProvider, input: ExtractionProviderInput): Promise<ExtractionProviderResult> {
  return provider.extractDocument(input)
    .then(validateProviderResult)
    .catch(() => ({ ok: false, errorCode: 'EXTRACTION_FAILED' as const, errorMessageSafe: 'No se pudo completar la extracción documental.', metadata: provider.metadata }))
}

/** Explicit local/test/certification wiring. Never import this from product UI. */
export function createLocalFixtureExtractionClient(provider = createFixtureExtractionProvider()): ExpenseExtractionClient {
  return { requestExtraction: (input) => safeProviderCall(provider, input) }
}
