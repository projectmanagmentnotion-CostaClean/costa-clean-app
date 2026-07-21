import { getSupabaseClient } from '../../lib/supabase'
import { getSupabasePublicEnv } from '../../lib/supabaseEnv'
import { operationalWriteRpcPaths } from '../../lib/operationalWriteRpc'
import type { JobBillingLineItem } from './types'

type JsonPayload = object
type JsonRecord = Record<string, unknown>
type JobSaveRpcError = {
  message?: string
  details?: string
  hint?: string
  code?: string
}

function getClientOrThrow() {
  const { client, error } = getSupabaseClient()

  if (!client) {
    throw new Error(error ?? 'No se pudo inicializar Supabase.')
  }

  return client
}

function isDevMode() {
  return typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV)
}

function logJobSaveDebug(message: string, payload: Record<string, unknown>) {
  if (!isDevMode()) return
  console.info(`[jobWriteApi] ${message}`, payload)
}

function logJobSaveError(message: string, payload: Record<string, unknown>) {
  if (!isDevMode()) return
  console.error(`[jobWriteApi] ${message}`, payload)
}

function getLineDebugSummary(lines: JsonPayload[]) {
  return lines.map((line, index) => {
    const record = line as JsonRecord
    return {
      index,
      id: record.id ?? null,
      sort_order: record.sort_order ?? null,
      concept: record.concept ?? null,
      quantity: record.quantity ?? null,
      unit_price: record.unit_price ?? null,
      line_subtotal: record.line_subtotal ?? null,
    }
  })
}

function normalizeJobSaveError(error: JobSaveRpcError | null | undefined, fallbackMessage: string) {
  const message = error?.message?.trim()
  const normalized = message?.toLowerCase() ?? ''

  if (
    normalized.includes('authentication required for financial writes')
    || normalized.includes('jwt')
    || normalized.includes('not authenticated')
    || normalized.includes('invalid claim')
  ) {
    return 'Tu sesion no esta activa para guardar servicios. Vuelve a iniciar sesion y repite el guardado.'
  }

  if (message) {
    return message
  }

  return fallbackMessage
}

export function getJobSaveSessionErrorMessage() {
  return 'Tu sesion no esta activa para guardar servicios. Vuelve a iniciar sesion y repite el guardado.'
}

export function buildSaveJobWithLinesRpcRequest({
  supabaseUrl,
  supabaseAnonKey,
  accessToken,
  job,
  lines,
}: {
  supabaseUrl: string
  supabaseAnonKey: string
  accessToken: string
  job: JsonPayload
  lines: JsonPayload[]
}) {
  return {
    url: `${supabaseUrl}/rest/v1/${operationalWriteRpcPaths.saveJobWithLines}`,
    init: {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_job: job,
        p_lines: lines,
      }),
    },
  }
}

export function getJobSaveErrorMessage(error: JobSaveRpcError | null | undefined) {
  return normalizeJobSaveError(error, 'No se pudo guardar el servicio y sus lineas.')
}

async function parseRpcError(response: Response): Promise<JobSaveRpcError | null> {
  try {
    const body = await response.json()
    if (body && typeof body === 'object') {
      return body as JobSaveRpcError
    }
  } catch {
    return null
  }

  return null
}

export async function saveJobWithLines(
  job: JsonPayload,
  lines: JsonPayload[],
): Promise<void> {
  const client = getClientOrThrow()
  const { supabaseUrl, supabaseAnonKey } = getSupabasePublicEnv()

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Faltan las variables de entorno de Supabase.')
  }

  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession()

  if (sessionError) {
    throw new Error(normalizeJobSaveError(
      { message: sessionError.message },
      'No se pudo validar la sesion antes de guardar el servicio.',
    ))
  }

  if (!session?.access_token) {
    throw new Error(getJobSaveSessionErrorMessage())
  }

  const jobRecord = job as JsonRecord
  logJobSaveDebug('Saving job with authenticated RPC.', {
    job_id: jobRecord.id ?? null,
    client_id: jobRecord.client_id ?? null,
    property_id: jobRecord.property_id ?? null,
    quote_id: jobRecord.quote_id ?? null,
    line_count: lines.length,
    has_session: true,
    line_summary: getLineDebugSummary(lines),
  })
  if (isDevMode()) {
    console.info('[jobWriteApi] rpc p_lines', {
      jobId: jobRecord.id ?? null,
      pLinesLength: lines.length,
      concepts: lines.map((line) => ((line as JsonRecord).concept ?? null)),
    })
  }

  const request = buildSaveJobWithLinesRpcRequest({
    supabaseUrl,
    supabaseAnonKey,
    accessToken: session.access_token,
    job,
    lines,
  })
  const response = await fetch(request.url, request.init)

  if (!response.ok) {
    const rpcError = await parseRpcError(response)
    logJobSaveError('save_job_with_lines failed.', {
      status: response.status,
      job_id: jobRecord.id ?? null,
      line_count: lines.length,
      error: rpcError,
    })
    throw new Error(getJobSaveErrorMessage(rpcError))
  }

  logJobSaveDebug('save_job_with_lines completed.', {
    job_id: jobRecord.id ?? null,
    line_count: lines.length,
  })
}

export function buildJobBillingSummary(lines: JobBillingLineItem[], fallbackConcept: string) {
  if (lines.length === 1) {
    return {
      billing_concept: lines[0].concept,
      billing_quantity: lines[0].quantity,
      billing_unit: lines[0].unit,
      billing_unit_price: lines[0].unit_price,
    }
  }

  const subtotal = lines.reduce((sum, line) => sum + line.line_subtotal, 0)
  const firstConcept = lines[0]?.concept || fallbackConcept

  return {
    billing_concept: firstConcept,
    billing_quantity: 1,
    billing_unit: 'servicio',
    billing_unit_price: Math.round((subtotal + Number.EPSILON) * 100) / 100,
  }
}

export function buildJobLinePayloads(lines: JobBillingLineItem[], jobId: string) {
  return lines.map((line, index) => ({
    id: line.id ?? `JOB-LINE-${jobId}-${index + 1}`,
    job_id: jobId,
    sort_order: line.sort_order ?? index + 1,
    concept: line.concept,
    quantity: line.quantity,
    unit: line.unit,
    unit_price: line.unit_price,
    line_subtotal: line.line_subtotal,
  }))
}
