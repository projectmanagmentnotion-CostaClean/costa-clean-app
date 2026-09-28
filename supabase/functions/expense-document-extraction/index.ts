import { createClient } from 'npm:@supabase/supabase-js@2'

const SCHEMA_VERSION = 1
const PROVIDER = 'fixture'
const PROVIDER_VERSION = 'n5.2-fixture-v1'
const BUCKET = 'expense-receipts'

type JsonRecord = Record<string, unknown>
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_REQUEST_BYTES = 16 * 1024
const MAX_ATTEMPT = 100

const json = (body: JsonRecord, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

const safeError = (errorCode: string, errorMessageSafe: string, metadata: null = null) => ({
  ok: false,
  errorCode,
  errorMessageSafe,
  metadata,
})

const field = (value: unknown, rawValue: string, confidence: number, page = 1) => ({
  value,
  rawValue,
  confidence,
  source: 'document',
  evidence: { page, text: rawValue },
})

const missing = () => ({
  value: null,
  rawValue: null,
  confidence: null,
  source: 'missing',
  evidence: null,
})

const fixtureProposal = () => ({
  schemaVersion: SCHEMA_VERSION,
  documentType: field('INVOICE', 'FACTURA', 0.98),
  supplier: {
    rawName: field('SUMINISTROS COSTA TEST S.L.', 'SUMINISTROS COSTA TEST S.L.', 0.97),
    legalNameCandidate: field('SUMINISTROS COSTA TEST S.L.', 'SUMINISTROS COSTA TEST S.L.', 0.94),
    commercialNameCandidate: field('Costa Test', 'COSTA TEST', 0.92),
    taxId: field('B12345678', 'CIF: B-12345678', 0.99),
    normalizedTaxIdCandidate: field('B12345678', 'B-12345678', 0.96),
    vatId: missing(), address: missing(), postalCode: missing(), city: missing(),
    country: field('ES', 'España', 0.88), phone: missing(), email: missing(), website: missing(),
  },
  invoice: {
    number: field('TEST-2026-001', 'TEST-2026-001', 0.96),
    issueDate: field('2026-09-28', '28/09/2026', 0.95),
    dueDate: missing(), currency: field('EUR', 'EUR', 0.99),
  },
  amounts: {
    net: field('150.00', '150,00 €', 0.98),
    tax: field('26.00', '26,00 €', 0.98),
    gross: field('176.00', '176,00 €', 0.98),
    discount: missing(), withholding: missing(),
  },
  vatLines: [
    { rate: field('10', 'IVA 10%', 0.82), base: field('50.00', 'Base 10%: 50,00 €', 0.8), tax: field('5.00', 'IVA 10%: 5,00 €', 0.8) },
    { rate: field('21', 'IVA 21%', 0.96), base: field('100.00', 'Base 21%: 100,00 €', 0.95), tax: field('21.00', 'IVA 21%: 21,00 €', 0.95) },
  ],
  payment: { method: missing() },
  confidence: { overall: 0.94 },
})

const readBody = async (req: Request) => {
  try {
    const contentType = req.headers.get('Content-Type')?.toLowerCase() ?? ''
    if (!contentType.startsWith('application/json')) return null
    const contentLength = Number(req.headers.get('Content-Length') ?? 0)
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) return null
    const rawBody = await req.text()
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) return null
    const body = JSON.parse(rawBody) as JsonRecord
    const captureSessionId = typeof body.captureSessionId === 'string' ? body.captureSessionId : ''
    const captureDocumentId = typeof body.captureDocumentId === 'string' ? body.captureDocumentId : ''
    const requestedAttempt = body.attempt === undefined ? 1 : body.attempt
    if (!UUID_PATTERN.test(captureSessionId) || !UUID_PATTERN.test(captureDocumentId)) return null
    if (typeof requestedAttempt !== 'number' || !Number.isInteger(requestedAttempt) || requestedAttempt < 1 || requestedAttempt > MAX_ATTEMPT) return null
    return { captureSessionId, captureDocumentId, attempt: requestedAttempt }
  } catch {
    return null
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405)

  const authorization = req.headers.get('Authorization')
  const token = authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'AUTH_REQUIRED' }, 401)

  const body = await readBody(req)
  if (!body) return json({ error: 'CAPTURE_DOCUMENT_REQUIRED' }, 400)

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !publishableKey || !serviceRoleKey) return json({ error: 'RUNTIME_NOT_CONFIGURED' }, 503)

  const userClient = createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const adminClient = createClient(url, serviceRoleKey)

  const { data: authData, error: authError } = await userClient.auth.getUser(token)
  if (authError || !authData.user) return json({ error: 'AUTH_INVALID' }, 401)

  const { data: session, error: sessionError } = await userClient
    .from('expense_capture_sessions')
    .select('id, created_by, status, expires_at')
    .eq('id', body.captureSessionId)
    .maybeSingle()
  const { data: document, error: documentError } = await userClient
    .from('expense_capture_documents')
    .select('id, capture_session_id, storage_path, original_filename, mime_type, file_size_bytes, sha256')
    .eq('id', body.captureDocumentId)
    .maybeSingle()

  const sessionExpired = !session?.expires_at || new Date(session.expires_at).getTime() <= Date.now()
  const terminalSession = session?.status === 'CANCELLED' || session?.status === 'COMPLETED' || session?.status === 'FINALIZING'
  if (sessionError || documentError || !session || !document || session.created_by !== authData.user.id || document.capture_session_id !== session.id || sessionExpired || terminalSession) {
    return json({ error: 'CAPTURE_DOCUMENT_NOT_FOUND' }, 404)
  }

  if (!document.original_filename.toLowerCase().startsWith('fixture-')) {
    return json({ ...safeError('EXTRACTION_RUNTIME_NOT_CONFIGURED', 'La extracción real no está configurada en QA.', { provider: PROVIDER, providerVersion: PROVIDER_VERSION }) }, 422)
  }

  if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(document.mime_type) || document.file_size_bytes > 10485760) {
    return json({ ...safeError('DOCUMENT_INVALID', 'El documento no cumple los límites admitidos.', null) }, 422)
  }

  const { data: privateFile, error: fileError } = await adminClient.storage.from(BUCKET).download(document.storage_path)
  if (fileError || !privateFile) {
    return json({ ...safeError('DOCUMENT_UNAVAILABLE', 'No se pudo leer el documento privado.', null) }, 422)
  }

  const attempt = body.attempt
  const idempotencyKey = `${document.sha256}:${SCHEMA_VERSION}:${PROVIDER}:${attempt}`
  const now = new Date().toISOString()
  const { data: extraction, error: insertError } = await adminClient
    .from('expense_capture_extractions')
    .insert({
      capture_document_id: document.id,
      capture_session_id: session.id,
      schema_version: SCHEMA_VERSION,
      attempt,
      status: 'PROCESSING',
      provider: PROVIDER,
      provider_version: PROVIDER_VERSION,
      model: null,
      idempotency_key: idempotencyKey,
      proposal: null,
      raw_text: null,
      started_at: now,
      completed_at: null,
      failed_at: null,
      error_code: null,
      error_message_safe: null,
      created_by: authData.user.id,
      updated_at: now,
    })
    .select('id, attempt, idempotency_key')
    .single()
  if (insertError || !extraction) return json({ error: 'EXTRACTION_ATTEMPT_ALREADY_EXISTS' }, 409)

  const proposal = fixtureProposal()
  const { error: updateError } = await adminClient
    .from('expense_capture_extractions')
    .update({
      status: 'SUCCEEDED',
      proposal,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', extraction.id)

  if (updateError) {
    await adminClient.from('expense_capture_extractions').update({
      status: 'FAILED',
      failed_at: new Date().toISOString(),
      error_code: 'PERSISTENCE_FAILED',
      error_message_safe: 'No se pudo guardar la propuesta de extracción.',
      updated_at: new Date().toISOString(),
    }).eq('id', extraction.id)
    return json({ ...safeError('PERSISTENCE_FAILED', 'No se pudo guardar la propuesta de extracción.', null) }, 500)
  }

  return json({
    ok: true,
    extractionId: extraction.id,
    attempt: extraction.attempt,
    proposal,
    metadata: { provider: PROVIDER, providerVersion: PROVIDER_VERSION, model: null },
  })
})
