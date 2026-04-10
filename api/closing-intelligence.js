const outputSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'executive_summary',
    'key_risks',
    'documentation_warnings',
    'suggested_manager_notes',
    'suggested_next_actions',
    'assistive_notice',
  ],
  properties: {
    executive_summary: { type: 'string' },
    key_risks: {
      type: 'array',
      items: { type: 'string' },
    },
    documentation_warnings: {
      type: 'array',
      items: { type: 'string' },
    },
    suggested_manager_notes: {
      type: 'array',
      items: { type: 'string' },
    },
    suggested_next_actions: {
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

  throw new Error('OpenAI no devolvió texto utilizable.')
}

function buildSystemPrompt(scope) {
  const scopeLabel = scope === 'quarterly' ? 'cierre trimestral' : 'cierre anual'

  return [
    `Eres un asistente de apoyo operativo para ${scopeLabel} de un CRM de servicios.`,
    'No calcules cifras nuevas ni inventes números.',
    'Interpreta solamente los datos estructurados recibidos.',
    'Si un dato no está en la entrada, no lo supongas.',
    'Sé sobrio, profesional y útil para revisión de gestoría/propietario.',
    'La salida debe ser estrictamente JSON válido que cumpla el schema.',
    'Las listas deben ser breves, concretas y accionables.',
    'En assistive_notice deja claro que el texto es interpretativo y no sustituye la revisión fiscal/contable.',
  ].join(' ')
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

  const { scope, payload } = req.body ?? {}

  if ((scope !== 'quarterly' && scope !== 'annual') || !payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Solicitud inválida para resumen inteligente.' })
  }

  try {
    const apiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CLOSING_SUMMARY_MODEL || 'gpt-4o-mini',
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: buildSystemPrompt(scope) }],
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: JSON.stringify(payload),
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'closing_intelligence_summary',
            schema: outputSchema,
            strict: true,
          },
        },
      }),
    })

    const responseJson = await apiResponse.json()

    if (!apiResponse.ok) {
      const errorMessage = responseJson?.error?.message || 'OpenAI devolvió un error generando el resumen.'
      return res.status(apiResponse.status).json({ error: errorMessage })
    }

    const outputText = extractOutputText(responseJson)
    const summary = JSON.parse(outputText)

    return res.status(200).json({
      summary,
      generated_at: new Date().toISOString(),
      model: process.env.OPENAI_CLOSING_SUMMARY_MODEL || 'gpt-4o-mini',
    })
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'No se pudo generar el resumen inteligente.',
    })
  }
}

