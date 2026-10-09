export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const preflight = (request: Request): Response | null => request.method === 'OPTIONS' ? new Response(null, { status: 204, headers: CORS_HEADERS }) : null
