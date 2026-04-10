import type { ClosingIntelligenceResponse } from './types'

interface ClosingIntelligenceRequest {
  scope: 'quarterly' | 'annual'
  payload: Record<string, unknown>
}

export async function generateClosingIntelligenceSummary(
  input: ClosingIntelligenceRequest,
): Promise<ClosingIntelligenceResponse> {
  const response = await fetch('/api/closing-intelligence', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  const data = (await response.json().catch(() => null)) as
    | ClosingIntelligenceResponse
    | { error?: string }
    | null

  if (!response.ok) {
    throw new Error(data && 'error' in data && data.error ? data.error : 'No se pudo generar el resumen inteligente.')
  }

  if (!data || !('summary' in data)) {
    throw new Error('La respuesta inteligente no llegó con el formato esperado.')
  }

  return data
}

