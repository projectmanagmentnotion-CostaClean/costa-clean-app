export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const preflight = (request: Request) => request.method === 'OPTIONS'
  ? new Response('ok', { status: 200, headers: CORS_HEADERS })
  : null
