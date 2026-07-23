import { getSupabasePublicEnv } from '../../lib/supabaseEnv'
import type {
  PublicQuizRequest,
  PublicQuizResponse,
  PublicQuizResult,
} from '../../../supabase/functions/_shared/publicQuizContract'

export const PUBLIC_QUIZ_GENERIC_ERROR = 'No se pudo enviar la prueba. Revisa la conexión e inténtalo de nuevo.'
export const PUBLIC_QUIZ_RATE_LIMIT_ERROR = 'Espera unos minutos antes de volver a enviar la prueba.'

interface PublicQuizApiDependencies {
  getEnv(): { supabaseUrl: string; supabaseAnonKey: string }
  fetch(input: string, init: RequestInit): Promise<Response>
}

const defaultDependencies: PublicQuizApiDependencies = {
  getEnv: getSupabasePublicEnv,
  fetch: (input, init) => fetch(input, init),
}

export async function createQuizAttempt(
  payload: PublicQuizRequest,
  dependencies: PublicQuizApiDependencies = defaultDependencies,
): Promise<PublicQuizResult> {
  const { supabaseUrl, supabaseAnonKey } = dependencies.getEnv()
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(PUBLIC_QUIZ_GENERIC_ERROR)
  }

  const response = await dependencies.fetch(`${supabaseUrl}/functions/v1/submit-public-gym-manual-quiz`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const body = await response.json().catch(() => null) as PublicQuizResponse | null
  if (!response.ok || !body?.ok) {
    throw new Error(response.status === 429 ? PUBLIC_QUIZ_RATE_LIMIT_ERROR : PUBLIC_QUIZ_GENERIC_ERROR)
  }
  return body.result
}
