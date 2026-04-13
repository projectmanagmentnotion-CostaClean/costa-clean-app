const sourceVersionFallback = 'spain-autonomo-expense-rules-2026-04-13'

const outputSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'classification',
    'deductibility_percentage',
    'vat_deductibility_percentage',
    'estimated_deductible_base',
    'estimated_deductible_vat',
    'confidence',
    'risk_level',
    'reasoning',
    'flags',
    'review_recommendation',
    'questions_for_user',
    'assistive_notice',
  ],
  properties: {
    classification: {
      type: 'string',
      enum: [
        'probably_deductible',
        'partially_deductible',
        'probably_not_deductible',
        'requires_review',
      ],
    },
    deductibility_percentage: { type: 'number', minimum: 0, maximum: 100 },
    vat_deductibility_percentage: { type: 'number', minimum: 0, maximum: 100 },
    estimated_deductible_base: { type: 'number', minimum: 0 },
    estimated_deductible_vat: { type: 'number', minimum: 0 },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
    reasoning: { type: 'string' },
    flags: {
      type: 'array',
      items: { type: 'string' },
    },
    review_recommendation: {
      type: 'string',
      enum: ['no_review_needed', 'user_review', 'gestoria_review'],
    },
    questions_for_user: {
      type: 'array',
      items: { type: 'string' },
    },
    assistive_notice: { type: 'string' },
  },
}

function extractOutputText(responseJson) {
  const output = Array.isArray(responseJson?.output) ? responseJson.output : []

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : []
    for (const block of content) {
      if (block?.type === 'output_text' && typeof block.text === 'string') {
        return block.text
      }
      if (block?.type === 'refusal' && typeof block.refusal === 'string') {
        throw new Error(block.refusal)
      }
    }
  }

  throw new Error('OpenAI no devolvio texto utilizable.')
}

function buildSystemPrompt() {
  return [
    'Eres un asistente fiscal de apoyo para clasificar gastos de un autonomo en Espana que presta servicios de limpieza premium.',
    'Tu respuesta es una estimacion prudente para revision del usuario o su gestoria, no asesoramiento fiscal definitivo.',
    'No uses OCR ni supongas contenido de documentos adjuntos. Interpreta solo los datos estructurados recibidos.',
    'Respeta el preanalisis determinista salvo que la descripcion estructurada justifique una postura mas conservadora.',
    'Aplica criterios conservadores: vinculacion con la actividad, soporte documental, registro y cautela especial para IVA.',
    'Para IVA, exige factura valida o deja el IVA deducible en cero o revision. En categorias de posible uso mixto, usa parcial o revision.',
    'No inventes datos. Si falta contexto, marca requires_review o gestoria_review.',
    'La salida debe ser estrictamente JSON valido que cumpla el schema.',
    'Usa espanol profesional, breve y claro. No digas que algo esta aprobado legalmente o confirmado por AEAT.',
  ].join(' ')
}

function isValidRequestBody(body) {
  return (
    body &&
    typeof body === 'object' &&
    body.expense &&
    typeof body.expense === 'object' &&
    body.deterministic_precheck &&
    typeof body.deterministic_precheck === 'object'
  )
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed.' })
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      error: 'Falta OPENAI_API_KEY en el entorno del servidor.',
    })
  }

  if (!isValidRequestBody(req.body)) {
    return res.status(400).json({ error: 'Solicitud invalida para estimacion fiscal.' })
  }

  const { expense, deterministic_precheck: deterministicPrecheck } = req.body
  const sourceVersion = typeof req.body.source_version === 'string'
    ? req.body.source_version
    : sourceVersionFallback
  const model = process.env.OPENAI_EXPENSE_FISCAL_MODEL || 'gpt-4o-mini'

  try {
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
            content: [
              {
                type: 'input_text',
                text: JSON.stringify({
                  expense,
                  deterministic_precheck: deterministicPrecheck,
                  source_version: sourceVersion,
                }),
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'expense_fiscal_intelligence_result',
            schema: outputSchema,
            strict: true,
          },
        },
      }),
    })

    const responseJson = await apiResponse.json()

    if (!apiResponse.ok) {
      const errorMessage = responseJson?.error?.message || 'OpenAI devolvio un error generando la estimacion fiscal.'
      return res.status(apiResponse.status).json({ error: errorMessage })
    }

    const outputText = extractOutputText(responseJson)
    const result = JSON.parse(outputText)

    return res.status(200).json({
      result,
      deterministic_precheck: deterministicPrecheck,
      generated_at: new Date().toISOString(),
      model,
      source_version: sourceVersion,
    })
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'No se pudo generar la estimacion fiscal.',
    })
  }
}
