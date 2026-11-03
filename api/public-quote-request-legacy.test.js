import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from './public-quote-request.js'

const saved = {
  enabled: process.env.COSTA_PUBLIC_WEB_INTAKE_ENABLED,
  url: process.env.SUPABASE_URL,
  viteUrl: process.env.VITE_SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  fetch: globalThis.fetch,
}

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name] = value },
    status(code) { this.statusCode = code; return this },
    json(value) { this.body = value; return this },
  }
}

afterEach(() => {
  for (const [key, value] of Object.entries({
    COSTA_PUBLIC_WEB_INTAKE_ENABLED: saved.enabled,
    SUPABASE_URL: saved.url,
    VITE_SUPABASE_URL: saved.viteUrl,
    SUPABASE_SERVICE_ROLE_KEY: saved.key,
  })) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  globalThis.fetch = saved.fetch
  vi.restoreAllMocks()
})

describe('existing CRM public quote route compatibility', () => {
  it('keeps the existing unsigned CRM form operational when the Web-only kill switch is off', async () => {
    delete process.env.SUPABASE_URL
    process.env.VITE_SUPABASE_URL = 'https://synthetic-crm.supabase.invalid'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-only-mock-key'
    process.env.COSTA_PUBLIC_WEB_INTAKE_ENABLED = 'false'

    const origins = []
    globalThis.fetch = vi.fn(async (url, options = {}) => {
      const target = new URL(url)
      origins.push(target.origin)
      const method = options.method || 'GET'
      if (method === 'GET') return Response.json([])
      if (target.pathname.endsWith('/intake_submissions') && method === 'POST') return Response.json([{ id: 'synthetic-legacy-intake' }])
      if (target.pathname.endsWith('/leads') && method === 'POST') return Response.json([{ id: 'synthetic-legacy-lead' }])
      if (target.pathname.endsWith('/lead_drafts') && method === 'POST') return Response.json([{ id: 'synthetic-legacy-draft' }])
      if (target.pathname.endsWith('/intake_submissions') && method === 'PATCH') return Response.json([{ id: 'synthetic-legacy-intake' }])
      throw new Error(`Unexpected mocked request ${method} ${target.pathname}`)
    })

    const now = Date.now()
    const req = {
      method: 'POST',
      headers: {},
      socket: { remoteAddress: `synthetic-legacy-${now}` },
      body: {
        source: 'public_quote_form',
        startedAt: new Date(now - 30_000).toISOString(),
        website: '',
        normalizedInput: {
          submittedAt: new Date(now).toISOString(),
          fullName: 'Persona sintética',
          phone: '+34000000001',
          email: 'legacy-test@example.invalid',
          serviceNeedLabel: 'Apartamentos turísticos',
          scopeNotes: 'Solicitud sintética de compatibilidad.',
          propertyType: 'Alojamiento turístico',
          sqmBand: '41-70 m²',
          rooms: '2',
          bathrooms: '1',
          requestedServiceDate: null,
          preferredTimeSlot: 'Mañana',
          serviceFrequencyLabel: 'Cambio entre huéspedes',
          preferredQuoteChannel: 'email',
          consentQuoteProcessing: true,
          postalCode: '08370',
          city: 'Calella',
          urgencyLabel: 'Flexible',
        },
      },
    }
    const res = response()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ ok: true })
    expect(origins.length).toBeGreaterThan(0)
    expect(origins.every((origin) => origin === 'https://synthetic-crm.supabase.invalid')).toBe(true)
    expect(globalThis.fetch.mock.calls.some(([, options]) => ['POST', 'PATCH'].includes(options?.method))).toBe(true)
  })

  it('never downgrades a request carrying Web authentication headers to the legacy path', async () => {
    process.env.COSTA_PUBLIC_WEB_INTAKE_ENABLED = 'false'
    globalThis.fetch = vi.fn()
    const res = response()
    await handler({ method: 'POST', headers: { 'x-costa-environment': 'production' }, body: {} }, res)
    expect(res.statusCode).toBe(503)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
