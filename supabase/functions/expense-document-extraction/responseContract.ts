import { CORS_HEADERS } from './cors.ts'

type JsonRecord = Record<string, unknown>

export const jsonResponse = (body: JsonRecord, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })

type ExistingSuccessfulExtraction = {
  proposal: unknown
  provider: unknown
  provider_version: unknown
  model: unknown
}

export const buildFreshSuccessResponse = (
  extractionId: string,
  attempt: number,
  proposal: unknown,
  metadata: JsonRecord,
): JsonRecord => ({
  ok: true,
  extractionId,
  attempt,
  proposal,
  metadata,
  reused: false,
})

export const buildReusedSuccessResponse = (
  row: ExistingSuccessfulExtraction | null | undefined,
  extractionId: string,
  attempt: number,
): JsonRecord | null => {
  if (
    !row ||
    row.proposal === null ||
    row.proposal === undefined ||
    typeof row.provider !== 'string' ||
    typeof row.provider_version !== 'string' ||
    (row.model !== null && typeof row.model !== 'string')
  ) return null

  return {
    ok: true,
    extractionId,
    attempt,
    proposal: row.proposal,
    metadata: {
      provider: row.provider,
      providerVersion: row.provider_version,
      model: row.model,
    },
    reused: true,
  }
}
