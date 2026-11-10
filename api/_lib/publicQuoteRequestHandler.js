import {
  buildCommunicationDraftPlaceholders,
  buildLeadPayload,
  buildQuoteDraftSeed,
  calculatePricing,
  nativeQuoteRequestFieldMap,
  normalizeRequestInput,
  validateInput,
} from '../../src/features/publicIntake/intakePipeline.mjs'
import {
  getClientIp,
  isHoneypotTriggered,
  registerIpAttempt,
  validateSubmissionTiming,
} from './requestProtection.js'
import { isProductionSupabaseUrl, PUBLIC_WEB_INTAKE_MAX_BODY_BYTES, verifyPublicWebIntake } from './publicWebIntakeAuth.js'

function getSupabaseServerConfig(mode) {
  const isWebIntake = mode === 'production-web'
  const supabaseUrl = isWebIntake
    ? process.env.SUPABASE_URL
    : process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (isWebIntake && (!isProductionSupabaseUrl(supabaseUrl || '') || !serviceRoleKey)) {
    throw new Error('El destino productivo de captación no está configurado.')
  }
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(isWebIntake
      ? 'El destino productivo de captación no está configurado.'
      : 'Faltan SUPABASE_URL/VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno del servidor.')
  }

  return { supabaseUrl, serviceRoleKey }
}

export function createPublicQuoteRequestHandler(mode = 'legacy') {
  const isWebIntake = mode === 'production-web'

  async function supabaseRequest(path, options = {}) {
    const { supabaseUrl, serviceRoleKey } = getSupabaseServerConfig(mode)
    const headers = {
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    }
    if (serviceRoleKey.startsWith('sb_secret_')) {
      delete headers.Authorization
    } else {
      headers.Authorization = `Bearer ${serviceRoleKey}`
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...options,
      headers,
    })

    const text = await response.text()
    const payload = text ? JSON.parse(text) : null
    if (!response.ok) throw new Error(`Supabase REST ${response.status}: ${text || response.statusText}`)
    return payload
  }

  async function insertRow(table, row) {
    const result = await supabaseRequest(`${table}?select=*`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(row),
    })
    return Array.isArray(result) ? result[0] : result
  }

  async function patchRow(table, id, row) {
    const result = await supabaseRequest(`${table}?id=eq.${encodeURIComponent(id)}&select=*`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(row),
    })
    return Array.isArray(result) ? result[0] : result
  }

  async function findExistingLead(input, normalizedPhone) {
    if (normalizedPhone) {
      const matches = await supabaseRequest(
        `leads?select=id,full_name,phone,email,city,status,normalized_phone&normalized_phone=eq.${encodeURIComponent(normalizedPhone)}&limit=1`,
      )
      if (Array.isArray(matches) && matches[0]) return matches[0]
    }

    if (input.email) {
      const matches = await supabaseRequest(
        `leads?select=id,full_name,phone,email,city,status,normalized_phone&email=eq.${encodeURIComponent(input.email)}&limit=1`,
      )
      if (Array.isArray(matches) && matches[0]) return matches[0]
    }

    return null
  }

  async function createOrUpdateLead(input, normalizedPhone, intakeSubmissionId, pricing) {
    const existingLead = await findExistingLead(input, normalizedPhone)
    const leadPayload = buildLeadPayload(input, normalizedPhone, intakeSubmissionId, pricing, existingLead, 'public_quote_form')
    if (existingLead) {
      const lead = await patchRow('leads', existingLead.id, leadPayload)
      return { lead, matchedExistingLead: true }
    }
    const lead = await insertRow('leads', leadPayload)
    return { lead, matchedExistingLead: false }
  }

  async function findSubmissionByIdempotencyKey(submissionId) {
    const matches = await supabaseRequest(
      `intake_submissions?select=id,status,lead_draft_id,lead_id&external_source_key=eq.${encodeURIComponent(`public_quote_form:${submissionId}`)}&limit=1`,
    )
    return Array.isArray(matches) ? matches[0] || null : null
  }

  async function claimIntakeSubmission(submissionId, row) {
    try {
      return { claimed: true, submission: await insertRow('intake_submissions', {
        ...row,
        external_source_key: `public_quote_form:${submissionId}`,
      }) }
    } catch (error) {
      // The verified partial unique index serializes concurrent Web retries.
      const existing = await findSubmissionByIdempotencyKey(submissionId)
      if (existing) return { claimed: false, submission: existing }
      throw error
    }
  }

  function respondForExistingSubmission(res, submission) {
    if (submission.status === 'converted' && submission.lead_draft_id) {
      return res.status(200).json({ ok: true, message: 'La solicitud ya se había recibido.' })
    }
    return res.status(409).json({ error: 'La solicitud ya está pendiente de revisión.' })
  }

  async function hasRecentDuplicateSubmission(input) {
    const tenMinutesAgoIso = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const checks = []
    if (input.phone) {
      checks.push(supabaseRequest(
        `lead_drafts?select=id&phone=eq.${encodeURIComponent(input.phone)}&created_at=gte.${encodeURIComponent(tenMinutesAgoIso)}&limit=1`,
      ))
    }
    if (input.email) {
      checks.push(supabaseRequest(
        `lead_drafts?select=id&email=eq.${encodeURIComponent(input.email)}&created_at=gte.${encodeURIComponent(tenMinutesAgoIso)}&limit=1`,
      ))
    }
    if (checks.length === 0) return false
    const results = await Promise.all(checks)
    return results.some((result) => Array.isArray(result) && result.length > 0)
  }

  return async function handler(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ error: 'Method not allowed.' })
    }

    // The Web-only kill switch runs before body parsing, Supabase config or network access.
    if (isWebIntake && process.env.COSTA_PUBLIC_WEB_INTAKE_ENABLED !== 'true') {
      return res.status(503).json({ error: 'El servicio de captación no está disponible.' })
    }

    try {
      const rawBody = req.body && typeof req.body === 'object' ? req.body : {}
      let clientKey
      let submissionId

      if (isWebIntake) {
        const contentLength = Number(req.headers['content-length'] || 0)
        if (contentLength > PUBLIC_WEB_INTAKE_MAX_BODY_BYTES || Buffer.byteLength(JSON.stringify(rawBody), 'utf8') > PUBLIC_WEB_INTAKE_MAX_BODY_BYTES) {
          return res.status(413).json({ error: 'Solicitud demasiado grande.' })
        }
        const signedRequest = verifyPublicWebIntake(rawBody, process.env.COSTA_PUBLIC_WEB_INTAKE_SECRET, req.headers)
        if (!signedRequest.ok) {
          return res.status(signedRequest.status).json({ error: signedRequest.status === 503 ? 'El servicio de captación no está configurado.' : 'Solicitud no válida.' })
        }
        if (!isProductionSupabaseUrl(process.env.SUPABASE_URL || '') || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
          return res.status(503).json({ error: 'El servicio de captación no está configurado.' })
        }
        if (rawBody.source !== 'public_quote_form' || rawBody.normalizedInput?.consentQuoteProcessing !== true || rawBody.consents?.privacyNoticeAccepted !== true) {
          return res.status(400).json({ error: 'La solicitud contiene campos incompletos.' })
        }
        clientKey = signedRequest.clientKey
        submissionId = signedRequest.submissionId
      } else {
        clientKey = getClientIp(req)
      }

      if (isHoneypotTriggered(rawBody)) return res.status(400).json({ error: 'Solicitud invalida.' })
      const timingValidation = validateSubmissionTiming({
        startedAt: rawBody.startedAt,
        submittedAt: rawBody.normalizedInput?.submittedAt,
      })
      if (!timingValidation.ok) return res.status(400).json({ error: timingValidation.error })
      if (!registerIpAttempt(clientKey)) {
        return res.status(429).json({
          error: 'Has enviado demasiadas solicitudes en poco tiempo. Espera unos minutos antes de reenviarla.',
        })
      }

      const { normalizedInput, normalizedPhone } = normalizeRequestInput(rawBody.normalizedInput || rawBody)
      const validationErrors = validateInput(normalizedInput, normalizedPhone)
      if (Object.keys(validationErrors).length > 0) {
        return res.status(400).json({ error: 'La solicitud contiene campos incompletos.', fieldErrors: validationErrors })
      }

      if (isWebIntake) {
        const existingSubmission = await findSubmissionByIdempotencyKey(submissionId)
        if (existingSubmission) return respondForExistingSubmission(res, existingSubmission)
      }
      if (await hasRecentDuplicateSubmission(normalizedInput)) {
        return res.status(429).json({
          error: 'Ya hemos recibido una solicitud reciente con estos datos. Espera unos minutos antes de reenviarla.',
        })
      }

      const pricing = calculatePricing(normalizedInput)
      const submissionRow = {
        source: 'public_quote_form',
        status: 'reviewing',
        submitted_at: normalizedInput.submittedAt,
        normalized_input: normalizedInput,
        raw_payload: rawBody,
        source_field_map: nativeQuoteRequestFieldMap,
        pricing_breakdown: pricing,
      }
      let intakeSubmission
      if (isWebIntake) {
        const claim = await claimIntakeSubmission(submissionId, submissionRow)
        if (!claim.claimed) return respondForExistingSubmission(res, claim.submission)
        intakeSubmission = claim.submission
      } else {
        intakeSubmission = await insertRow('intake_submissions', submissionRow)
      }

      const { lead, matchedExistingLead } = await createOrUpdateLead(normalizedInput, normalizedPhone, intakeSubmission.id, pricing)
      const communicationDrafts = buildCommunicationDraftPlaceholders(normalizedInput, pricing)
      const quoteDraftSeed = buildQuoteDraftSeed(normalizedInput, pricing)
      const leadDraft = await insertRow('lead_drafts', {
        intake_submission_id: intakeSubmission.id,
        suggested_full_name: normalizedInput.fullName,
        phone: normalizedInput.phone,
        email: normalizedInput.email,
        city: normalizedInput.city,
        postal_code: normalizedInput.postalCode,
        status: matchedExistingLead ? 'matched_existing_lead' : 'ready_for_review',
        matched_lead_id: lead.id,
        normalized_input: normalizedInput,
        quote_draft_seed: quoteDraftSeed,
        pricing_breakdown: pricing,
        ai_email_draft: communicationDrafts.ai_email_draft,
        ai_whatsapp_draft: communicationDrafts.ai_whatsapp_draft,
        ai_draft_status: communicationDrafts.ai_draft_status,
        ai_generation_metadata: communicationDrafts.ai_generation_metadata,
      })
      await patchRow('intake_submissions', intakeSubmission.id, {
        status: 'converted', lead_draft_id: leadDraft.id, lead_id: lead.id, quote_id: null,
      })

      return res.status(200).json({
        ok: true,
        message: 'Solicitud recibida. Prepararemos tu presupuesto y lo revisaremos antes de responder.',
        intakeSubmissionId: intakeSubmission.id,
        leadDraftId: leadDraft.id,
        quoteDraftId: leadDraft.id,
        leadId: lead.id,
        quoteId: null,
        matchedExistingLead,
        pricing,
      })
    } catch (error) {
      return res.status(500).json({ error: isWebIntake ? 'No se pudo procesar la solicitud.' : error instanceof Error ? error.message : 'No se pudo procesar la solicitud.' })
    }
  }
}
