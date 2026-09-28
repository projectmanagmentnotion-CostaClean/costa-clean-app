import type {
  ExtractionProviderResult,
} from './expenseExtractionProvider'
import type { ExtractionProviderInput } from './expenseExtractionProvider'
import type { DocumentExtractionProvider } from './expenseExtractionProvider'

export interface ExpenseExtractionClient {
  requestExtraction(input: ExtractionProviderInput): Promise<ExtractionProviderResult>
}

const unavailableResult = (): ExtractionProviderResult => ({
  ok: false,
  errorCode: 'EXTRACTION_RUNTIME_NOT_CONFIGURED',
  errorMessageSafe: 'La extracción documental no está configurada en este entorno.',
  metadata: { provider: 'fixture', providerVersion: 'not-configured', model: null },
})

function safeProviderCall(provider: DocumentExtractionProvider, input: ExtractionProviderInput): Promise<ExtractionProviderResult> {
  return provider.extractDocument(input).catch(() => ({
    ok: false,
    errorCode: 'EXTRACTION_FAILED' as const,
    errorMessageSafe: 'No se pudo completar la extracción documental.',
    metadata: provider.metadata,
  }))
}

export function createExpenseExtractionClient(options: { provider?: DocumentExtractionProvider; allowFixture?: boolean } = {}): ExpenseExtractionClient {
  const allowFixture = options.allowFixture ?? (import.meta.env.DEV && import.meta.env.VITE_N52_LOCAL_FIXTURE === 'true')
  return {
    async requestExtraction(input) {
      if (options.provider) return safeProviderCall(options.provider, input)
      if (!allowFixture) return unavailableResult()
      try {
        const { createFixtureExtractionProvider } = await import('./expenseExtractionProvider')
        return await safeProviderCall(createFixtureExtractionProvider(), input)
      } catch {
        return unavailableResult()
      }
    },
  }
}
