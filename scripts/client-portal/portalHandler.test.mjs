import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { createPortalHandler } from '../../supabase/functions/_shared/portalHandler.ts'

const QA_URL = 'https://kpvvydthlxupjjqqdpxy.supabase.co'
const PROD_URL = 'https://wfxnwfcdjainpojhbdri.supabase.co'
const ORIGIN = 'https://portal-qa.example.invalid'
const USER_ID = '11111111-1111-4111-8111-111111111111'
const CLIENT_A = 'QA-CP2-CLIENT-A'
const DOCUMENT_ID = '22222222-2222-4222-8222-222222222222'
const INVOICE_ID = 'QA-CP2-INVOICE-A'
const PEPPER = 'x'.repeat(64)

function dependencies(overrides = {}) {
  const values = {
    SUPABASE_URL: QA_URL,
    SUPABASE_ANON_KEY: 'anon-placeholder',
    SUPABASE_SERVICE_ROLE_KEY: 'server-placeholder',
    PORTAL_INVITATION_PEPPER: PEPPER,
    PORTAL_RATE_LIMIT_PEPPER: PEPPER,
    PORTAL_ALLOWED_ORIGIN: ORIGIN,
  }
  return {
    env: (name) => values[name],
    fetch: vi.fn(),
    now: () => Date.UTC(2026, 6, 23),
    randomBytes: (length) => new Uint8Array(length).fill(7),
    log: vi.fn(),
    ...overrides,
  }
}

function request(body) {
  return new Request('https://edge.example.invalid', {
    method: 'POST',
    headers: {
      authorization: 'Bearer browser-token-placeholder',
      'content-type': 'application/json',
      origin: ORIGIN,
      'x-forwarded-for': '127.0.0.1',
    },
    body: JSON.stringify(body),
  })
}

function authResponse() {
  return new Response(JSON.stringify({
    id: USER_ID,
    email: 'member@example.invalid',
    email_confirmed_at: '2026-07-23T00:00:00Z',
    aal: 'aal2',
  }), { status: 200 })
}

describe('client portal Edge trust boundary', () => {
  it('rejects production before any network request', async () => {
    const values = {
      SUPABASE_URL: PROD_URL,
      SUPABASE_ANON_KEY: 'anon-placeholder',
      SUPABASE_SERVICE_ROLE_KEY: 'server-placeholder',
      PORTAL_INVITATION_PEPPER: PEPPER,
      PORTAL_RATE_LIMIT_PEPPER: PEPPER,
      PORTAL_ALLOWED_ORIGIN: ORIGIN,
    }
    const deps = dependencies({ env: (name) => values[name] })
    const response = await createPortalHandler('account', deps)(request({
      action: 'submitApplication',
      contactName: null,
      companyName: null,
      contactPhone: null,
      privacyNoticeVersion: 'qa-v1',
    }))
    expect(response.status).toBe(503)
    expect(deps.fetch).not.toHaveBeenCalled()
  })

  it('returns the same generic denial for wrong-client and random document IDs', async () => {
    for (const documentId of [DOCUMENT_ID, '33333333-3333-4333-8333-333333333333']) {
      const deps = dependencies()
      deps.fetch.mockResolvedValueOnce(authResponse())
      deps.fetch.mockResolvedValueOnce(new Response('{}', { status: 404 }))
      const response = await createPortalHandler('invoice', deps)(request({
        action: 'downloadInvoice',
        clientId: CLIENT_A,
        invoiceId: INVOICE_ID,
        documentId,
      }))
      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({
        ok: false,
        error: { code: 'request_unavailable' },
      })
    }
  })

  it('signs only the exact authorized opaque object for 60 seconds', async () => {
    const objectKey = `${DOCUMENT_ID}/${USER_ID}.pdf`
    const deps = dependencies()
    deps.fetch.mockResolvedValueOnce(authResponse())
    deps.fetch.mockResolvedValueOnce(new Response(JSON.stringify({
      objectKey,
      expiresIn: 60,
    }), { status: 200 }))
    deps.fetch.mockResolvedValueOnce(new Response(JSON.stringify({
      signedURL: '/object/sign/invoice-documents/runtime-signature',
    }), { status: 200 }))
    const response = await createPortalHandler('invoice', deps)(request({
      action: 'downloadInvoice',
      clientId: CLIENT_A,
      invoiceId: INVOICE_ID,
      documentId: DOCUMENT_ID,
    }))
    expect(response.status).toBe(200)
    const signingCall = deps.fetch.mock.calls[2]
    expect(signingCall[0]).toContain(`/invoice-documents/${objectKey}`)
    expect(JSON.parse(signingCall[1].body)).toEqual({ expiresIn: 60 })
    expect(await response.json()).toMatchObject({ expiresIn: 60 })
  })

  it('hashes invitation tokens before RPC and never returns them', async () => {
    let deliveredToken
    const deps = dependencies({
      deliverInvitation: async ({ token }) => {
        deliveredToken = token
        return true
      },
    })
    deps.fetch.mockResolvedValueOnce(authResponse())
    deps.fetch.mockResolvedValueOnce(new Response(JSON.stringify(DOCUMENT_ID), { status: 200 }))
    const response = await createPortalHandler('members', deps)(request({
      action: 'inviteMember',
      clientId: CLIENT_A,
      email: 'invitee@example.invalid',
      role: 'client_member',
    }))
    expect(response.status).toBe(202)
    const rpcBody = JSON.parse(deps.fetch.mock.calls[1][1].body)
    expect(rpcBody.p_token_hash).toMatch(/^[0-9a-f]{64}$/u)
    expect(rpcBody.p_token_hash).not.toBe(deliveredToken)
    expect(JSON.stringify(rpcBody)).not.toContain(deliveredToken)
    expect(JSON.stringify(await response.json())).not.toContain(deliveredToken)
  })

  it('keeps service-role use outside frontend sources and forbids email ownership matching', () => {
    const handler = readFileSync('supabase/functions/_shared/portalHandler.ts', 'utf8')
    const contract = readFileSync('supabase/functions/_shared/portalContract.ts', 'utf8')
    const migration = readFileSync('supabase/migrations/20260723160000_client_portal_security_boundary.sql', 'utf8')
    const frontend = readFileSync('src/lib/supabase.ts', 'utf8')
    expect(frontend).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(handler).toContain("dependencies.env('SUPABASE_SERVICE_ROLE_KEY')")
    expect(handler).not.toContain('console.log')
    expect(contract).not.toContain('internalNotes')
    expect(migration).not.toMatch(/clients[\s\S]{0,100}email\s*=/iu)
    expect(migration).not.toContain('raw_token')
  })
})
