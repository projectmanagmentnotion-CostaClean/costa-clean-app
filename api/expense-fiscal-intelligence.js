const retiredEndpointMessage = 'La inteligencia fiscal heredada ya no esta disponible. Usa el flujo Smart Expense.'

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
  }

  return res.status(410).json({
    error: retiredEndpointMessage,
    code: 'LEGACY_FISCAL_INTELLIGENCE_RETIRED',
  })
}
