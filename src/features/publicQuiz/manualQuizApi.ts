import { getSupabasePublicEnv } from '../../lib/supabaseEnv'
import type { PublicQuizAttempt } from './types'

type QuizAttemptInsert = Omit<PublicQuizAttempt, 'id' | 'fecha'>

export async function createQuizAttempt(payload: QuizAttemptInsert): Promise<PublicQuizAttempt> {
  const { supabaseUrl, supabaseAnonKey } = getSupabasePublicEnv()
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Faltan las variables de entorno de Supabase.')
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/submit_public_gym_manual_quiz_attempt`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_attempt: payload }),
  })

  if (!response.ok) {
    const detail = (await response.text()).trim()
    throw new Error(`No se pudo guardar el intento. REST ${response.status}: ${detail || response.statusText}`)
  }

  const body = await response.json().catch(() => null)
  const row = Array.isArray(body) ? body[0] : body
  if (!row) throw new Error('No se pudo confirmar el intento guardado.')
  return row as PublicQuizAttempt
}
