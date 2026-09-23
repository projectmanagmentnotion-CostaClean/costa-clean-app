import { createClient } from '@supabase/supabase-js'
import { recoverAuthenticatedQaSession } from './auth/recoveredQaSession.mjs'

export async function teardownN21FuncRun(runId, rootDir = process.cwd()) {
  const recovered = await recoverAuthenticatedQaSession(rootDir)
  if (recovered.projectRef !== 'kpvvydthlxupjjqqdpxy' || !recovered.authenticatedUserPresent) {
    throw new Error('N21_QA_TEARDOWN_AUTH_OR_PROJECT_GATE_FAILED')
  }
  const client = createClient(recovered.supabaseUrl, recovered.supabaseAnonKey, {
    accessToken: async () => recovered.accessToken,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data, error } = await client.rpc('qa_n21_func_teardown', { p_run_id: runId })
  if (error) throw new Error(`qa_n21_func_teardown: ${error.message}`)
  return data
}
