import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabasePublicEnv } from './supabaseEnv'

let supabaseClient: SupabaseClient | null = null

export function getSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabasePublicEnv()

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      client: null,
      error: 'Faltan las variables de entorno de Supabase.',
    }
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
  }

  return {
    client: supabaseClient,
    error: null,
  }
}
