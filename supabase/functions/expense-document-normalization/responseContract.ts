type JsonRecord = Record<string, unknown>

export const json = (body: JsonRecord, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

export const safeError = (errorCode: string, errorMessageSafe: string, status: number, headers: Record<string, string>) => json({ ok: false, errorCode, errorMessageSafe }, status, headers)
