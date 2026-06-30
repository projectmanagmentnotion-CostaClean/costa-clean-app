import { getSupabaseClient } from '../../lib/supabase'
import { normalizeClientFiscalData } from './clientFiscalData'
import type { ClientListItem } from './types'

const clientSelectFields = 'id,display_code,created_at,full_name,phone,email,tax_id,billing_address,status,source_lead_id'

function getClientOrThrow() {
  const { client, error } = getSupabaseClient()

  if (!client) {
    throw new Error(error ?? 'No se pudo inicializar Supabase.')
  }

  return client
}

interface ClientRecordInput {
  id?: string
  full_name?: string
  phone?: string | null
  email?: string | null
  tax_id?: string | null
  billing_address?: string | null
  status?: string
  source_lead_id?: string | null
}

export async function createClientRecord(input: Required<Pick<ClientRecordInput, 'id' | 'full_name' | 'status'>> & ClientRecordInput): Promise<ClientListItem> {
  const client = getClientOrThrow()
  const fiscalData = normalizeClientFiscalData({
    tax_id: input.tax_id ?? null,
    billing_address: input.billing_address ?? null,
    fiscal_name: input.full_name,
  })
  const { data, error } = await client
    .from('clients')
    .insert({
      id: input.id,
      full_name: input.full_name.trim(),
      phone: input.phone ?? null,
      email: input.email ?? null,
      tax_id: fiscalData.tax_id,
      billing_address: fiscalData.billing_address,
      status: input.status,
      source_lead_id: input.source_lead_id ?? null,
    })
    .select(clientSelectFields)
    .single()

  if (error) {
    throw new Error(error.message || 'No se pudo crear el cliente.')
  }

  return data as ClientListItem
}

export async function updateClientRecord(
  clientId: string,
  input: ClientRecordInput,
): Promise<ClientListItem> {
  const client = getClientOrThrow()
  const fiscalData = normalizeClientFiscalData({
    tax_id: input.tax_id,
    billing_address: input.billing_address,
    fiscal_name: input.full_name,
  })
  const payload: ClientRecordInput = {}

  if (typeof input.full_name === 'string') payload.full_name = input.full_name.trim()
  if ('phone' in input) payload.phone = input.phone ?? null
  if ('email' in input) payload.email = input.email ?? null
  if ('tax_id' in input) payload.tax_id = fiscalData.tax_id
  if ('billing_address' in input) payload.billing_address = fiscalData.billing_address
  if (typeof input.status === 'string') payload.status = input.status
  if ('source_lead_id' in input) payload.source_lead_id = input.source_lead_id ?? null

  const { data, error } = await client
    .from('clients')
    .update(payload)
    .eq('id', clientId)
    .select(clientSelectFields)
    .single()

  if (error) {
    throw new Error(error.message || 'No se pudo actualizar el cliente.')
  }

  return data as ClientListItem
}

export async function updateClientFiscalData(
  clientId: string,
  input: Pick<ClientRecordInput, 'tax_id' | 'billing_address'>,
): Promise<ClientListItem> {
  const fiscalData = normalizeClientFiscalData(input)

  if (!fiscalData.tax_id || !fiscalData.billing_address) {
    throw new Error('Debes completar NIF/CIF y direccion de facturacion.')
  }

  return updateClientRecord(clientId, {
    tax_id: fiscalData.tax_id,
    billing_address: fiscalData.billing_address,
  })
}

