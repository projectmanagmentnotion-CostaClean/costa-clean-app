import type { ExtractionProviderInput, ExtractionProviderResult } from './expenseExtractionContract'

export interface ExpenseExtractionClient {
  requestExtraction(input: ExtractionProviderInput): Promise<ExtractionProviderResult>
}

const runtimeNotConfigured = (): ExtractionProviderResult => ({
  ok: false,
  errorCode: 'EXTRACTION_RUNTIME_NOT_CONFIGURED',
  errorMessageSafe: 'La extracción documental no está configurada en este entorno.',
  metadata: null,
})

/** Browser-safe product boundary. Trusted server wiring is intentionally external to this module. */
export function createExpenseExtractionClient(): ExpenseExtractionClient {
  return {
    async requestExtraction() {
      return runtimeNotConfigured()
    },
  }
}
