import { getSupabaseClient } from '../../lib/supabase'

type LifecycleTable = 'jobs' | 'invoices' | 'quotes' | 'expenses' | 'clients' | 'properties' | 'leads'

async function getClientOrThrow() {
  const { client, error } = getSupabaseClient()
  if (error || !client) {
    throw new Error(error ?? 'No se pudo crear el cliente Supabase.')
  }

  return client
}

export async function patchLifecycleEntity(
  table: LifecycleTable,
  entityId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const client = await getClientOrThrow()
  const { error } = await client
    .from(table)
    .update(payload)
    .eq('id', entityId)

  if (error) {
    throw new Error(error.message)
  }
}
