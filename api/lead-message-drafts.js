import {
  buildCommunicationDraftPlaceholders,
  costaCleanLeadQuoteMessagingEngine,
  isForbiddenServiceRequested,
  resolveMessageBias,
} from '../src/config/costaCleanLeadQuoteMessagingEngine.runtime.mjs'

const outputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['email_subject', 'email_body', 'whatsapp_message', 'review_notes'],
  properties: {
    email_subject: { type: 'string' },
    email_body: { type: 'string' },
    whatsapp_message: { type: 'string' },
    review_notes: {
      type: 'array',
      items: { type: 'string' },
    },
  },
}

function extractOutputText(responseJson) {
  const output = Array.isArray(responseJson?.output) ? responseJson.output : []

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : []
    for (const block of content) {
      if (block?.type === 'output_text' && typeof block.text === 'string') return block.text
      if (block?.type === 'refusal' && typeof block.refusal === 'string') throw new Error(block.refusal)
    }
  }

  throw new Error('OpenAI no devolvio texto utilizable.')
}

function buildEmailSubject(input) {
  const service = input.serviceNeedLabel || 'servicio de limpieza'
  const city = input.city || input.postalCode || 'tu zona'
  return `Costa Clean BCN - presupuesto para ${service} en ${city}`
}

function buildFallbackDrafts(input, pricing, reason) {
  const fallback = buildCommunicationDraftPlaceholders(input, pricing)
  return {
    email_subject: buildEmailSubject(input),
    email_body: fallback.ai_email_draft,
    whatsapp_message: fallback.ai_whatsapp_draft,
    review_notes: [
      'Borrador generado con fallback determinista del motor.',
      reason,
      'Debe revisarse manualmente antes de abrir, copiar o enviar.',
    ],
    metadata: {
      ...fallback.ai_generation_metadata,
      provider: 'fallback',
      integration_status: reason,
      auto_send: false,
    },
  }
}

function buildSystemPrompt() {
  return [
    `Eres asistente comercial de ${costaCleanLeadQuoteMessagingEngine.businessName}.`,
    'Genera borradores comerciales en espanol para email y WhatsApp.',
    'No envies nada. No digas que el mensaje fue enviado.',
    'Todo es borrador sujeto a revision manual obligatoria.',
    'Respeta la politica: claridad, sin sorpresas, escalabilidad y profesionalidad.',
    'Incluye las condiciones obligatorias del motor si encajan de forma natural.',
    'No inventes disponibilidad, descuentos, datos fiscales ni servicios no indicados.',
    'Si hay servicio prohibido, marca limite con tono educado y pide revision humana.',
    'Devuelve JSON estricto segun el schema.',
  ].join(' ')
}

function buildUserPayload(input, pricing) {
  return {
    lead: {
      name: input.fullName,
      city: input.city,
      postalCode: input.postalCode,
      serviceType: input.serviceNeedLabel,
      propertyType: input.propertyType,
      urgency: input.urgencyLabel,
      scopeNotes: input.scopeNotes,
      preferredChannel: input.preferredQuoteChannel,
      previousIssues: input.previousCleaningIssues,
    },
    quote: {
      subtotal: pricing?.subtotal,
      taxAmount: pricing?.taxAmount,
      total: pricing?.total,
      currency: pricing?.currency,
      pricingVersion: pricing?.version,
      conditions: costaCleanLeadQuoteMessagingEngine.mandatoryMessages,
    },
    engine: {
      version: costaCleanLeadQuoteMessagingEngine.version,
      manualReview: costaCleanLeadQuoteMessagingEngine.manualReview,
      toneBias: resolveMessageBias(input),
      forbiddenServiceRequested: isForbiddenServiceRequested(input),
      forbiddenServices: costaCleanLeadQuoteMessagingEngine.forbiddenServices,
    },
  }
}

function normalizeGeneratedDrafts(parsed, input) {
  return {
    email_subject: String(parsed.email_subject || buildEmailSubject(input)).trim(),
    email_body: String(parsed.email_body || '').trim(),
    whatsapp_message: String(parsed.whatsapp_message || '').trim(),
    review_notes: Array.isArray(parsed.review_notes)
      ? parsed.review_notes.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
      : [],
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed.' })
  }

  const { normalized_input: normalizedInput, pricing_breakdown: pricingBreakdown } = req.body ?? {}

  if (!normalizedInput || typeof normalizedInput !== 'object') {
    return res.status(400).json({ error: 'Falta normalized_input para generar borradores.' })
  }

  if (!pricingBreakdown || typeof pricingBreakdown !== 'object') {
    return res.status(400).json({ error: 'Falta pricing_breakdown para generar borradores.' })
  }

  if (!process.env.OPENAI_API_KEY) {
    const fallback = buildFallbackDrafts(normalizedInput, pricingBreakdown, 'missing_openai_api_key')
    return res.status(200).json({ ok: true, source: 'fallback', ...fallback })
  }

  try {
    const model = process.env.OPENAI_LEAD_MESSAGE_MODEL || 'gpt-4o-mini'
    const apiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: buildSystemPrompt() }],
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: JSON.stringify(buildUserPayload(normalizedInput, pricingBreakdown)) }],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'lead_message_drafts',
            schema: outputSchema,
            strict: true,
          },
        },
      }),
    })

    const responseJson = await apiResponse.json()

    if (!apiResponse.ok) {
      const fallback = buildFallbackDrafts(normalizedInput, pricingBreakdown, responseJson?.error?.message || 'openai_error')
      return res.status(200).json({ ok: true, source: 'fallback', ...fallback })
    }

    const parsed = JSON.parse(extractOutputText(responseJson))
    const generated = normalizeGeneratedDrafts(parsed, normalizedInput)

    if (!generated.email_body || !generated.whatsapp_message) {
      const fallback = buildFallbackDrafts(normalizedInput, pricingBreakdown, 'openai_empty_draft')
      return res.status(200).json({ ok: true, source: 'fallback', ...fallback })
    }

    return res.status(200).json({
      ok: true,
      source: 'openai',
      ...generated,
      metadata: {
        provider: 'openai',
        integration_status: 'generated',
        model,
        auto_send: false,
        engine_id: costaCleanLeadQuoteMessagingEngine.engineId,
        engine_version: costaCleanLeadQuoteMessagingEngine.version,
        pricing_version: costaCleanLeadQuoteMessagingEngine.pricingVersion,
        message_bias: resolveMessageBias(normalizedInput),
        generated_at: new Date().toISOString(),
      },
    })
  } catch (error) {
    const fallback = buildFallbackDrafts(
      normalizedInput,
      pricingBreakdown,
      error instanceof Error ? error.message : 'openai_generation_failed',
    )
    return res.status(200).json({ ok: true, source: 'fallback', ...fallback })
  }
}
