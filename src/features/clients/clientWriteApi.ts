import { getSupabasePublicEnv } from '../../lib/supabaseEnv.ts'
import {
  createClientId,
  normalizeClientInput,
  normalizeClientStatus,
  trimNullable,
} from './clientIdentity.ts'
import { normalizeClientFiscalData } from './clientFiscalData.ts'
import type { ClientListItem } from './types.ts'

const clientSelectFields = 'id,display_code,created_at,full_name,phone,email,tax_id,billing_address,status,source_lead_id'

interface SupabaseRestError {
  code?: string
  details?: string | null
  hint?: string | null
  message?: string
}

function getRestConfigOrThrow() {
  const { supabaseUrl, supabaseAnonKey } = getSupabasePublicEnv()
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Faltan las variables de entorno de Supabase.')
  }

  return { supabaseUrl, supabaseAnonKey }
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

function maskTaxId(value: string | null | undefined): string | null {
  if (!value) return null
  if (value.length <= 4) return '****'
  return `${value.slice(0, 4)}***${value.slice(-2)}`
}

function buildClientWriteHeaders(supabaseAnonKey: string) {
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  }
}

function logClientWriteDebug(payload: {
  operation: 'create' | 'update'
  clientId: string | null
  payload: ClientRecordInput
  result?: {
    ok: boolean
    rows?: number
    error?: SupabaseRestError | null
  }
}) {
  const isDevRuntime = typeof import.meta !== 'undefined' && typeof import.meta.env === 'object' && Boolean(import.meta.env?.DEV)
  if (!isDevRuntime) return

  const maskedPayload = {
    ...payload.payload,
    tax_id: maskTaxId(payload.payload.tax_id),
    billing_address: payload.payload.billing_address ? '[masked]' : payload.payload.billing_address,
  }

  const baseLog = {
    operation: payload.operation,
    table: 'clients',
    clientId: payload.clientId,
    payloadKeys: Object.keys(payload.payload),
    payloadPreview: maskedPayload,
  }

  if (!payload.result) {
    console.debug('[clientWriteApi]', baseLog)
    return
  }

  console.warn('[clientWriteApi]', {
    ...baseLog,
    result: payload.result,
  })
}

async function parseSupabaseError(response: Response): Promise<SupabaseRestError> {
  const fallbackError: SupabaseRestError = {
    message: response.statusText || 'Error desconocido de Supabase.',
  }

  try {
    const rawBody = await response.text()
    if (!rawBody.trim()) {
      return fallbackError
    }

    try {
      return JSON.parse(rawBody) as SupabaseRestError
    } catch {
      return {
        ...fallbackError,
        message: rawBody,
      }
    }
  } catch {
    return fallbackError
  }
}

function toSupabaseErrorMessage(
  error: SupabaseRestError,
  fallbackMessage: string,
): string {
  if (
    error.code === '23502'
    && typeof error.message === 'string'
    && error.message.includes('column "id"')
  ) {
    return 'No se pudo crear el cliente porque falta identificador interno.'
  }

  return error.message || fallbackMessage
}

function buildClientPayload(input: ClientRecordInput): ClientRecordInput {
  const fiscalData = normalizeClientFiscalData({
    tax_id: input.tax_id,
    billing_address: input.billing_address,
    fiscal_name: input.full_name,
  })
  const payload: ClientRecordInput = {}

  if (typeof input.id === 'string') payload.id = normalizeClientId(input.id)
  if (typeof input.full_name === 'string') payload.full_name = input.full_name.trim()
  if ('phone' in input) payload.phone = trimNullable(input.phone)
  if ('email' in input) payload.email = trimNullable(input.email)
  if ('tax_id' in input) payload.tax_id = fiscalData.tax_id
  if ('billing_address' in input) payload.billing_address = fiscalData.billing_address
  if ('status' in input) payload.status = normalizeClientStatus(input.status)
  if ('archived_at' in input) payload.archived_at = input.archived_at ?? null
  if ('source_lead_id' in input) payload.source_lead_id = trimNullable(input.source_lead_id)

  return payload
}

async function executeClientRestWrite({
  operation,
  clientId,
  method,
  payload,
}: {
  operation: 'create' | 'update'
  clientId: string | null
  method: 'POST' | 'PATCH'
  payload: ClientRecordInput
}): Promise<ClientListItem> {
  const { supabaseUrl, supabaseAnonKey } = getRestConfigOrThrow()
  const targetUrl = method === 'POST'
    ? `${supabaseUrl}/rest/v1/clients?select=${encodeURIComponent(clientSelectFields)}`
    : `${supabaseUrl}/rest/v1/clients?id=eq.${encodeURIComponent(normalizeClientId(clientId ?? ''))}&select=${encodeURIComponent(clientSelectFields)}`

  logClientWriteDebug({ operation, clientId, payload })

  const response = await fetch(targetUrl, {
    method,
    headers: buildClientWriteHeaders(supabaseAnonKey),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await parseSupabaseError(response)
    logClientWriteDebug({
      operation,
      clientId,
      payload,
      result: { ok: false, error },
    })
    throw new Error(toSupabaseErrorMessage(
      error,
      operation === 'create'
        ? 'No se pudo crear el cliente.'
        : 'No se pudo actualizar el cliente.',
    ))
  }

  const rows = ((await response.json()) as ClientListItem[]) ?? []
  logClientWriteDebug({
    operation,
    clientId,
    payload,
    result: { ok: true, rows: rows.length },
  })

  return normalizeReturnedClientRows(rows, {
    emptyMessage: operation === 'create'
      ? 'No se pudo confirmar el cliente creado. Revisa permisos o vuelve a intentarlo.'
      : 'No se actualizo ningun cliente. Puede ser un problema de permisos o identificador.',
    multipleMessage: operation === 'create'
      ? 'Se recibieron varios clientes al crear la ficha. Revisa la escritura antes de continuar.'
      : 'La actualizacion del cliente devolvio varias filas. Revisa el filtro antes de continuar.',
  })
}

interface ClientRecordInput {
  id?: string
  full_name?: string
  phone?: string | null
  email?: string | null
  tax_id?: string | null
  billing_address?: string | null
  status?: string
  archived_at?: string | null
  source_lead_id?: string | null
}

export async function createClientRecord(input: ClientRecordInput): Promise<ClientListItem> {
  try {
    const normalizedInput = normalizeClientInput({
      id: input.id ?? createClientId(),
      full_name: input.full_name,
      phone: input.phone ?? null,
      email: input.email ?? null,
      tax_id: input.tax_id ?? null,
      billing_address: input.billing_address ?? null,
      status: input.status,
      source_lead_id: input.source_lead_id ?? null,
    })
    const payload = buildClientPayload(normalizedInput)

    return await executeClientRestWrite({
      operation: 'create',
      clientId: normalizedInput.id,
      method: 'POST',
      payload,
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
    const payload = buildClientPayload(input)

    return await executeClientRestWrite({
      operation: 'update',
      clientId: normalizedClientId,
      method: 'PATCH',
      payload,
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

export async function applyClientFiscalBackfillRecord(
  clientId: string,
  input: Pick<ClientRecordInput, 'tax_id' | 'billing_address' | 'full_name' | 'status'>,
): Promise<ClientListItem> {
  const fiscalData = normalizeClientFiscalData(input)
  const payload: ClientRecordInput = {}

  if ('tax_id' in input) payload.tax_id = fiscalData.tax_id
  if ('billing_address' in input) payload.billing_address = fiscalData.billing_address
  if (typeof input.full_name === 'string') payload.full_name = input.full_name.trim()
  if (typeof input.status === 'string') payload.status = input.status

  if (Object.keys(payload).length === 0) {
    throw new Error('No hay cambios validos para aplicar en el backfill fiscal.')
  }

  return updateClientRecord(clientId, payload)
}

export const __clientWriteApiTestUtils = {
  buildClientPayload,
  createClientId,
  maskTaxId,
  normalizeClientInput,
  normalizeClientStatus,
  normalizeClientId,
  normalizeReturnedClientRows,
  trimNullable,
  toClientWriteError,
}
