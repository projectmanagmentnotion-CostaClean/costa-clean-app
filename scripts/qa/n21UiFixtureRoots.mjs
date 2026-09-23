import { createClient } from '@supabase/supabase-js'
import { recoverAuthenticatedQaSession } from './auth/recoveredQaSession.mjs'

export async function ensureN21UiFixtureRoots(runId, rootDir = process.cwd()) {
  const normalizedRunId = String(runId ?? '').trim()
  if (!/^[0-9a-f]{32}$/u.test(normalizedRunId)) throw new Error('ROOT_FIXTURE_REQUIRES_32_HEX_RUN_ID')
  const token = `QA_N2_FUNC_${normalizedRunId}`
  const recovered = await recoverAuthenticatedQaSession(rootDir)
  const client = createClient(recovered.supabaseUrl, recovered.supabaseAnonKey, { accessToken: async () => recovered.accessToken, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const rpc = async (name, args) => { const { data, error } = await client.rpc(name, args); if (error) throw new Error(`${name}: ${error.message}`); return data }
  const clientFixture = { id: `CLIENT-${token}-UIROOT`, full_name: `${token}_CLIENT`, phone: '600000000', email: `${normalizedRunId}@qa.invalid`, tax_id: `QA${normalizedRunId.slice(0, 8)}`, billing_address: `${token} billing`, status: 'active' }
  const propertyFixture = { id: `PROPERTY-${token}-UIROOT`, client_id: clientFixture.id, name: `${token}_PROPERTY`, property_type: 'apartment', address: `${token} address`, city: 'Barcelona', postal_code: '08001', notes: token }
  const existingClient = await client.from('clients').select('id,full_name,email').eq('id', clientFixture.id).maybeSingle()
  if (existingClient.error) throw existingClient.error
  if (!existingClient.data) await rpc('create_client', { p_client: clientFixture })
  else if (existingClient.data.full_name !== clientFixture.full_name || existingClient.data.email !== clientFixture.email) throw new Error('ROOT_FIXTURE_CLIENT_IDENTITY_MISMATCH')
  const existingProperty = await client.from('properties').select('id,client_id,name').eq('id', propertyFixture.id).maybeSingle()
  if (existingProperty.error) throw existingProperty.error
  if (!existingProperty.data) await rpc('create_property', { p_property: propertyFixture })
  else if (existingProperty.data.client_id !== propertyFixture.client_id || existingProperty.data.name !== propertyFixture.name) throw new Error('ROOT_FIXTURE_PROPERTY_IDENTITY_MISMATCH')
  return { runId: normalizedRunId, client: clientFixture, property: propertyFixture }
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const roots = await ensureN21UiFixtureRoots(process.argv[2])
  process.stdout.write(`${JSON.stringify(roots)}\n`)
}
