import { createHash, createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from './public-web-quote-request.js'

const saved = {
  secret: process.env.COSTA_PUBLIC_WEB_INTAKE_SECRET,
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  viteUrl: process.env.VITE_SUPABASE_URL,
  intakeEnabled: process.env.COSTA_PUBLIC_WEB_INTAKE_ENABLED,
  fetch: globalThis.fetch,
}
const syntheticSubmissionId = '22222222-2222-4222-8222-222222222222'
const timestamp = String(Math.floor(Date.now() / 1000))
const secret = 'synthetic-only-test-secret-with-more-than-32-bytes'

function signedRequest(overrides = {}, client = 'synthetic-client') {
  const body = {
    source: 'public_quote_form',
    submissionId: syntheticSubmissionId,
    startedAt: new Date(Date.now() - 30_000).toISOString(),
    website: '',
    normalizedInput: {
      submittedAt: new Date().toISOString(),
      fullName: 'Persona sintética',
      phone: '+34000000000',
      email: 'test@example.invalid',
      serviceNeedLabel: 'Apartamentos turísticos',
      scopeNotes: 'Necesidades seleccionadas: turnover.',
      propertyType: 'Alojamiento turístico',
      sqmBand: '41-70 m²',
      rooms: '2',
      bathrooms: '1',
      requestedServiceDate: null,
      preferredTimeSlot: 'Mañana',
      serviceFrequencyLabel: 'Cambio entre huéspedes',
      preferredQuoteChannel: 'both',
      consentQuoteProcessing: true,
      postalCode: '08370',
      city: 'Calella',
      urgencyLabel: 'Flexible',
    },
    consents: { privacyNoticeAccepted: true, marketingContactOptIn: false, analytics: false, advertising: false },
    ...overrides,
  }
  const clientKey = createHmac('sha256', secret).update(`client:${client}`).digest('hex')
  const hash = createHash('sha256').update(JSON.stringify(body)).digest('hex')
  const signature = createHmac('sha256', secret).update(`${timestamp}.production.${hash}.${body.submissionId}.${clientKey}`).digest('hex')
  return {
    body,
    headers: {
      'content-length': String(Buffer.byteLength(JSON.stringify(body))),
      'x-costa-environment': 'production',
      'x-costa-submission-id': body.submissionId,
      'x-costa-client-key': clientKey,
      'x-costa-timestamp': timestamp,
      'x-costa-signature': signature,
    },
  }
}

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name] = value },
    status(code) { this.statusCode = code; return this },
    json(value) { this.body = value; return this },
  }
}

function setupEnvironment() {
  process.env.COSTA_PUBLIC_WEB_INTAKE_ENABLED = 'true'
  process.env.COSTA_PUBLIC_WEB_INTAKE_SECRET = secret
  process.env.SUPABASE_URL = 'https://wfxnwfcdjainpojhbdri.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-role-placeholder-for-mocked-test'
  delete process.env.VITE_SUPABASE_URL
}

afterEach(() => {
  if (saved.secret === undefined) delete process.env.COSTA_PUBLIC_WEB_INTAKE_SECRET
  else process.env.COSTA_PUBLIC_WEB_INTAKE_SECRET = saved.secret
  if (saved.url === undefined) delete process.env.SUPABASE_URL
  else process.env.SUPABASE_URL = saved.url
  if (saved.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
  else process.env.SUPABASE_SERVICE_ROLE_KEY = saved.key
  if (saved.viteUrl === undefined) delete process.env.VITE_SUPABASE_URL
  else process.env.VITE_SUPABASE_URL = saved.viteUrl
  if (saved.intakeEnabled === undefined) delete process.env.COSTA_PUBLIC_WEB_INTAKE_ENABLED
  else process.env.COSTA_PUBLIC_WEB_INTAKE_ENABLED = saved.intakeEnabled
  globalThis.fetch = saved.fetch
  vi.restoreAllMocks()
})

describe('CRM Production public intake boundary', () => {
  it('fails closed before contacting Supabase when the server kill switch is absent or off', async () => {
    const request = signedRequest()
    globalThis.fetch = vi.fn()
    delete process.env.COSTA_PUBLIC_WEB_INTAKE_ENABLED
    const absent = createResponse()
    await handler({ method: 'POST', headers: request.headers, body: request.body }, absent)
    process.env.COSTA_PUBLIC_WEB_INTAKE_ENABLED = 'false'
    const disabled = createResponse()
    await handler({ method: 'POST', headers: request.headers, body: request.body }, disabled)
    expect([absent.statusCode, disabled.statusCode]).toEqual([503, 503])
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('accepts a signed synthetic request through mocked CRM writes only', async () => {
    setupEnvironment()
    const writes = []
    globalThis.fetch = vi.fn(async (url, options = {}) => {
      const target = new URL(url)
      const method = options.method || 'GET'
      if (method === 'POST' || method === 'PATCH') writes.push({ method, pathname: target.pathname })
      if (target.pathname.endsWith('/intake_submissions') && method === 'GET') return Response.json([])
      if (target.pathname.endsWith('/leads') && method === 'GET') return Response.json([])
      if (target.pathname.endsWith('/lead_drafts') && method === 'GET') return Response.json([])
      if (target.pathname.endsWith('/intake_submissions') && method === 'POST') return Response.json([{ id: 'synthetic-intake-id' }])
      if (target.pathname.endsWith('/leads') && method === 'POST') return Response.json([{ id: 'synthetic-lead-id' }])
      if (target.pathname.endsWith('/lead_drafts') && method === 'POST') return Response.json([{ id: 'synthetic-draft-id' }])
      if (target.pathname.endsWith('/intake_submissions') && method === 'PATCH') return Response.json([{ id: 'synthetic-intake-id' }])
      throw new Error(`Unexpected mocked Supabase request ${method} ${target.pathname}`)
    })
    const request = signedRequest()
    const response = createResponse()
    await handler({ method: 'POST', headers: request.headers, body: request.body, socket: { remoteAddress: 'synthetic' } }, response)
    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({ ok: true })
    expect(writes.map(({ method, pathname }) => [method, pathname])).toEqual([
      ['POST', '/rest/v1/intake_submissions'], ['POST', '/rest/v1/leads'], ['POST', '/rest/v1/lead_drafts'], ['PATCH', '/rest/v1/intake_submissions'],
    ])
  })

  it('rejects missing signatures, QA signatures, and Production URL misconfiguration before writes', async () => {
    setupEnvironment()
    let calls = 0
    globalThis.fetch = vi.fn(async () => { calls += 1; return Response.json([]) })
    const request = signedRequest()
    const unsigned = createResponse()
    await handler({ method: 'POST', headers: {}, body: request.body }, unsigned)
    const qa = createResponse()
    await handler({ method: 'POST', headers: { ...request.headers, 'x-costa-environment': 'qa' }, body: request.body }, qa)
    process.env.SUPABASE_URL = 'https://kpvvydthlxupjjqqdpxy.supabase.co'
    const crossed = createResponse()
    await handler({ method: 'POST', headers: request.headers, body: request.body }, crossed)
    expect([unsigned.statusCode, qa.statusCode, crossed.statusCode]).toEqual([401, 401, 503])
    expect(calls).toBe(0)
  })

  it('treats a replayed submission id as a duplicate without CRM writes', async () => {
    setupEnvironment()
    const readPaths = []
    globalThis.fetch = vi.fn(async (url, options = {}) => {
      const target = new URL(url)
      readPaths.push(target.pathname + target.search)
      return Response.json(target.search.includes('external_source_key') ? [{ id: 'synthetic-existing-intake', status: 'converted', lead_draft_id: 'synthetic-existing-draft' }] : [])
    })
    const request = signedRequest()
    const response = createResponse()
    await handler({ method: 'POST', headers: request.headers, body: request.body }, response)
    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({ ok: true })
    expect(readPaths.some((path) => path.includes('external_source_key'))).toBe(true)
    expect(globalThis.fetch.mock.calls.some(([, options]) => options?.method === 'POST' || options?.method === 'PATCH')).toBe(false)
  })

  it('fails closed after a partial CRM write and does not duplicate it on replay', async () => {
    setupEnvironment()
    let claimedSubmission
    const writes = []
    globalThis.fetch = vi.fn(async (url, options = {}) => {
      const target = new URL(url)
      const method = options.method || 'GET'
      if (method === 'GET' && target.search.includes('external_source_key')) {
        return Response.json(claimedSubmission ? [claimedSubmission] : [])
      }
      if (method === 'GET') return Response.json([])
      if (method === 'POST' && target.pathname.endsWith('/intake_submissions')) {
        writes.push('intake')
        claimedSubmission = { id: 'synthetic-partial-intake', status: 'reviewing' }
        return Response.json([claimedSubmission])
      }
      if (method === 'POST' && target.pathname.endsWith('/leads')) {
        writes.push('lead')
        return new Response('Synthetic internal CRM diagnostic', { status: 500 })
      }
      throw new Error(`Unexpected mocked Supabase request ${method} ${target.pathname}`)
    })

    const request = signedRequest({}, 'synthetic-partial-failure')
    const failed = createResponse()
    await handler({ method: 'POST', headers: request.headers, body: request.body }, failed)
    const replay = createResponse()
    await handler({ method: 'POST', headers: request.headers, body: request.body }, replay)

    expect(failed.statusCode).toBe(500)
    expect(failed.body).toEqual({ error: 'No se pudo procesar la solicitud.' })
    expect(JSON.stringify(failed.body)).not.toContain('Synthetic internal CRM diagnostic')
    expect(replay.statusCode).toBe(409)
    expect(writes).toEqual(['intake', 'lead'])
  })

  it('creates at most one intake and one lead for concurrent identical submission ids', async () => {
    setupEnvironment()
    const submissions = new Map()
    const writes = []
    let firstReads = 0
    let releaseFirstReads
    const bothFirstReads = new Promise((resolve) => { releaseFirstReads = resolve })

    globalThis.fetch = vi.fn(async (url, options = {}) => {
      const target = new URL(url)
      const method = options.method || 'GET'
      const isIntakes = target.pathname.endsWith('/intake_submissions')
      if (isIntakes && method === 'GET' && target.search.includes('external_source_key')) {
        const key = decodeURIComponent(target.search.match(/external_source_key=eq\.([^&]+)/)?.[1] || '')
        if (!submissions.has(key) && firstReads < 2) {
          firstReads += 1
          if (firstReads === 2) releaseFirstReads()
          await bothFirstReads
          return Response.json([])
        }
        return Response.json(submissions.has(key) ? [submissions.get(key)] : [])
      }
      if (isIntakes && method === 'GET') return Response.json([])
      if (target.pathname.endsWith('/leads') && method === 'GET') return Response.json([])
      if (target.pathname.endsWith('/lead_drafts') && method === 'GET') return Response.json([])
      if (isIntakes && method === 'POST') {
        const row = JSON.parse(options.body)
        const key = row.external_source_key
        if (submissions.has(key)) return Response.json({ code: '23505', message: 'duplicate key' }, { status: 409 })
        const claim = { id: 'synthetic-intake-id', status: 'reviewing', lead_draft_id: null, external_source_key: key }
        submissions.set(key, claim)
        writes.push('intake')
        return Response.json([{ id: claim.id }])
      }
      if (target.pathname.endsWith('/leads') && method === 'POST') {
        writes.push('lead')
        return Response.json([{ id: 'synthetic-lead-id' }])
      }
      if (target.pathname.endsWith('/lead_drafts') && method === 'POST') {
        writes.push('draft')
        const claim = [...submissions.values()][0]
        claim.status = 'converted'
        claim.lead_draft_id = 'synthetic-draft-id'
        return Response.json([{ id: 'synthetic-draft-id' }])
      }
      if (isIntakes && method === 'PATCH') {
        writes.push('complete')
        return Response.json([{ id: 'synthetic-intake-id' }])
      }
      throw new Error(`Unexpected mocked Supabase request ${method} ${target.pathname}`)
    })

    const request = signedRequest()
    const responses = [createResponse(), createResponse()]
    await Promise.all(responses.map((response) => handler({ method: 'POST', headers: request.headers, body: request.body, socket: { remoteAddress: 'synthetic-concurrent' } }, response)))

    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409])
    expect(writes.filter((write) => write === 'intake')).toHaveLength(1)
    expect(writes.filter((write) => write === 'lead')).toHaveLength(1)
    expect(writes.filter((write) => write === 'draft')).toHaveLength(1)
  })

  it('continues to accept distinct valid submission ids', async () => {
    setupEnvironment()
    let sequence = 0
    globalThis.fetch = vi.fn(async (url, options = {}) => {
      const target = new URL(url)
      const method = options.method || 'GET'
      if (method === 'GET') return Response.json([])
      if (method === 'POST' && target.pathname.endsWith('/intake_submissions')) return Response.json([{ id: `synthetic-intake-${++sequence}` }])
      if (method === 'POST' && target.pathname.endsWith('/leads')) return Response.json([{ id: `synthetic-lead-${sequence}` }])
      if (method === 'POST' && target.pathname.endsWith('/lead_drafts')) return Response.json([{ id: `synthetic-draft-${sequence}` }])
      if (method === 'PATCH' && target.pathname.endsWith('/intake_submissions')) return Response.json([{ id: `synthetic-intake-${sequence}` }])
      throw new Error(`Unexpected mocked Supabase request ${method} ${target.pathname}`)
    })
    const first = signedRequest({ submissionId: '33333333-3333-4333-8333-333333333333' })
    const second = signedRequest({ submissionId: '44444444-4444-4444-8444-444444444444' })
    const responses = [createResponse(), createResponse()]
    await Promise.all([
      handler({ method: 'POST', headers: first.headers, body: first.body, socket: { remoteAddress: 'synthetic-distinct-a' } }, responses[0]),
      handler({ method: 'POST', headers: second.headers, body: second.body, socket: { remoteAddress: 'synthetic-distinct-b' } }, responses[1]),
    ])
    expect(responses.map((response) => response.statusCode)).toEqual([200, 200])
  })
})
