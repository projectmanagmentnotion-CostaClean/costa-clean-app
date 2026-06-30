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

function normalizeClientId(clientId: string): string {
  const normalizedClientId = clientId.trim()
  if (!normalizedClientId) {
    throw new Error('No se pudo actualizar el cliente porque falta el identificador.')
  }

  return normalizedClientId
}

function normalizeReturnedClientRows(
  rows: ClientListItem[] | null,
  options: {
    emptyMessage: string
    multipleMessage: string
  },
): ClientListItem {
  if (!rows || rows.length === 0) {
    throw new Error(options.emptyMessage)
  }

  if (rows.length > 1) {
    throw new Error(options.multipleMessage)
  }

  return rows[0] as ClientListItem
}

function toClientWriteError(
  error: unknown,
  fallbackMessage: string,
): Error {
  if (error instanceof Error) {
    if (error.message.includes('Cannot coerce the result to a single JSON object')) {
      return new Error(fallbackMessage)
    }

    return error
  }

  return new Error(fallbackMessage)
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
  try {
    const client = getClientOrThrow()
    const fiscalData = normalizeClientFiscalData({
      tax_id: input.tax_id ?? null,
      billing_address: input.billing_address ?? null,
      fiscal_name: input.full_name,
    })
    const { data, error } = await client
      .from('clients')
      .insert({
        id: normalizeClientId(input.id),
        full_name: input.full_name.trim(),
        phone: input.phone ?? null,
        email: input.email ?? null,
        tax_id: fiscalData.tax_id,
        billing_address: fiscalData.billing_address,
        status: input.status,
        source_lead_id: input.source_lead_id ?? null,
      })
      .select(clientSelectFields)

    if (error) {
      throw new Error(error.message || 'No se pudo crear el cliente.')
    }

    return normalizeReturnedClientRows(data as ClientListItem[] | null, {
      emptyMessage: 'No se pudo confirmar el cliente creado. Revisa permisos o vuelve a intentarlo.',
      multipleMessage: 'Se recibieron varios clientes al crear la ficha. Revisa la escritura antes de continuar.',
    })
  } catch (error) {
    throw toClientWriteError(error, 'No se pudo crear el cliente. Revisa la conexion o permisos y vuelve a intentarlo.')
  }
}

export async function updateClientRecord(
  clientId: string,
  input: ClientRecordInput,
): Promise<ClientListItem> {
  try {
    const normalizedClientId = normalizeClientId(clientId)
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
      .eq('id', normalizedClientId)
      .select(clientSelectFields)

    if (error) {
      throw new Error(error.message || 'No se pudo actualizar el cliente.')
    }

    return normalizeReturnedClientRows(data as ClientListItem[] | null, {
      emptyMessage: 'No se pudo actualizar el cliente. Revisa la conexion o permisos y vuelve a intentarlo.',
      multipleMessage: 'La actualizacion del cliente devolvio varias filas. Revisa el filtro antes de continuar.',
    })
  } catch (error) {
    throw toClientWriteError(error, 'No se pudo actualizar el cliente. Revisa la conexion o permisos y vuelve a intentarlo.')
  }
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

export const __clientWriteApiTestUtils = {
  normalizeClientId,
  normalizeReturnedClientRows,
  toClientWriteError,
}
