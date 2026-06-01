import { getSupabaseClient } from '../../lib/supabase'
import type { PublicQuizAttempt } from './types'

const QUIZ_ATTEMPTS_TABLE = 'public_gym_manual_quiz_attempts'

type QuizAttemptInsert = Omit<PublicQuizAttempt, 'id'>

export async function fetchRecentQuizAttempts(limit = 50): Promise<PublicQuizAttempt[]> {
  const { client, error } = getSupabaseClient()

  if (error || !client) {
    throw new Error(error ?? 'No se pudo iniciar Supabase.')
  }

  const { data, error: queryError } = await client
    .from(QUIZ_ATTEMPTS_TABLE)
    .select('id, nombre_trabajador, puntuacion, porcentaje, aprobado, fecha, respuestas_json, errores_json, total_preguntas')
    .order('fecha', { ascending: false })
    .limit(limit)

  if (queryError) {
    throw new Error(queryError.message)
  }

  return (data ?? []) as PublicQuizAttempt[]
}

export async function createQuizAttempt(payload: QuizAttemptInsert): Promise<PublicQuizAttempt> {
  const { client, error } = getSupabaseClient()

  if (error || !client) {
    throw new Error(error ?? 'No se pudo iniciar Supabase.')
  }

  const { data, error: insertError } = await client
    .from(QUIZ_ATTEMPTS_TABLE)
    .insert(payload)
    .select('id, nombre_trabajador, puntuacion, porcentaje, aprobado, fecha, respuestas_json, errores_json, total_preguntas')
    .single()

  if (insertError || !data) {
    throw new Error(insertError?.message ?? 'No se pudo guardar el intento.')
  }

  return data as PublicQuizAttempt
}
