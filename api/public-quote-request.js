import {
  buildCommunicationDraftPlaceholders,
  buildLeadPayload,
  buildQuoteDraftSeed,
  calculatePricing,
  nativeQuoteRequestFieldMap,
  normalizeRequestInput,
  validateInput,
} from '../src/features/publicIntake/intakePipeline.mjs'
import {
  getClientIp,
  isHoneypotTriggered,
  registerIpAttempt,
  validateSubmissionTiming,
} from './_lib/requestProtection.js'

function getSupabaseServerConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Faltan SUPABASE_URL/VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno del servidor.')
  }

  return { supabaseUrl, serviceRoleKey }
}

async function supabaseRequest(path, options = {}) {
  const { supabaseUrl, serviceRoleKey } = getSupabaseServerConfig()
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new Error(`Supabase REST ${response.status}: ${text || response.statusText}`)
  }

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

async function hasRecentDuplicateSubmission(input) {
  const tenMinutesAgoIso = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const checks = []

  if (input.phone) {
    checks.push(
      supabaseRequest(
        `lead_drafts?select=id&phone=eq.${encodeURIComponent(input.phone)}&created_at=gte.${encodeURIComponent(tenMinutesAgoIso)}&limit=1`,
      ),
    )
  }

  if (input.email) {
    checks.push(
      supabaseRequest(
        `lead_drafts?select=id&email=eq.${encodeURIComponent(input.email)}&created_at=gte.${encodeURIComponent(tenMinutesAgoIso)}&limit=1`,
      ),
    )
  }

  if (checks.length === 0) {
    return false
  }

  const results = await Promise.all(checks)
  return results.some((result) => Array.isArray(result) && result.length > 0)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed.' })
  }

  try {
    const rawBody = req.body && typeof req.body === 'object' ? req.body : {}
    if (isHoneypotTriggered(rawBody)) {
      return res.status(400).json({ error: 'Solicitud invalida.' })
    }

    const timingValidation = validateSubmissionTiming({
      startedAt: rawBody.startedAt,
      submittedAt: rawBody.normalizedInput?.submittedAt,
    })
    if (!timingValidation.ok) {
      return res.status(400).json({ error: timingValidation.error })
    }

    const clientIp = getClientIp(req)
    if (!registerIpAttempt(clientIp)) {
      return res.status(429).json({
        error: 'Has enviado demasiadas solicitudes en poco tiempo. Espera unos minutos e intentalo de nuevo.',
      })
    }

    const { normalizedInput, normalizedPhone } = normalizeRequestInput(rawBody.normalizedInput || rawBody)
    const validationErrors = validateInput(normalizedInput, normalizedPhone)

    if (Object.keys(validationErrors).length > 0) {
      return res.status(400).json({
        error: 'La solicitud contiene campos incompletos.',
        fieldErrors: validationErrors,
      })
    }

    if (await hasRecentDuplicateSubmission(normalizedInput)) {
      return res.status(429).json({
        error: 'Ya hemos recibido una solicitud reciente con estos datos. Espera unos minutos antes de reenviarla.',
      })
    }

    const pricing = calculatePricing(normalizedInput)
    const intakeSubmission = await insertRow('intake_submissions', {
      source: 'public_quote_form',
      status: 'reviewing',
      submitted_at: normalizedInput.submittedAt,
      normalized_input: normalizedInput,
      raw_payload: rawBody,
      source_field_map: nativeQuoteRequestFieldMap,
      pricing_breakdown: pricing,
    })

    const { lead, matchedExistingLead } = await createOrUpdateLead(
      normalizedInput,
      normalizedPhone,
      intakeSubmission.id,
      pricing,
    )
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
      status: 'converted',
      lead_draft_id: leadDraft.id,
      lead_id: lead.id,
      quote_id: null,
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
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'No se pudo procesar la solicitud.',
    })
  }
}
