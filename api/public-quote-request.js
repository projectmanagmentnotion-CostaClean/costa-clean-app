import { createPublicQuoteRequestHandler } from './_lib/publicQuoteRequestHandler.js'

const legacyHandler = createPublicQuoteRequestHandler('legacy')
const productionWebHandler = createPublicQuoteRequestHandler('production-web')
const productionWebHeaders = [
  'x-costa-environment',
  'x-costa-submission-id',
  'x-costa-client-key',
  'x-costa-timestamp',
  'x-costa-signature',
]

export default function handler(req, res) {
  const headers = req?.headers || {}
  const isProductionWebRequest = productionWebHeaders.some((name) => headers[name] !== undefined)
  return (isProductionWebRequest ? productionWebHandler : legacyHandler)(req, res)
}
