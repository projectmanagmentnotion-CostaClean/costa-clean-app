import { describe, expect, it } from 'vitest'
import {
  buildPortalInvitationEmail,
  createDisabledTransactionalEmailProvider,
  createTransactionalEmailProviderFromEnvironment,
  toTransactionalEmailAuditEvent,
} from '../../supabase/functions/_shared/transactionalEmail.ts'
import { BREVO_TRANSACTIONAL_EMAIL_ENDPOINT, createBrevoTransactionalEmailProvider } from '../../supabase/functions/_shared/brevoTransactionalEmail.ts'
import { readFileSync } from 'node:fs'
import { vi } from 'vitest'

const INVITATION_URL = 'https://portal-qa.example.invalid/invitations/accept?token=synthetic-one-time-token'

function invitationInput(overrides = {}) {
  return {
    recipient: 'qa.portal.invitation@qa.invalid',
    locale: 'es-ES',
    invitationUrl: INVITATION_URL,
    expiresAt: '2026-09-23T12:00:00.000Z',
    idempotencyKey: 'invite:qa-correlation-1',
    correlationId: 'qa-correlation-1',
    ...overrides,
  }
}

describe('transactional email provider foundation', () => {
  it('builds the server-only PORTAL_INVITATION contract with explicit idempotency', () => {
    expect(buildPortalInvitationEmail(invitationInput())).toEqual({
      template: 'PORTAL_INVITATION',
      recipient: 'qa.portal.invitation@qa.invalid',
      locale: 'es-ES',
      variables: {
        invitationUrl: INVITATION_URL,
        expiresAt: '2026-09-23T12:00:00.000Z',
      },
      idempotencyKey: 'invite:qa-correlation-1',
      correlationId: 'qa-correlation-1',
    })
  })

  it('fails closed while no owner-approved provider is wired', async () => {
    const provider = createDisabledTransactionalEmailProvider()

    await expect(provider.sendTransactionalEmail(buildPortalInvitationEmail(invitationInput()))).resolves.toEqual({
      status: 'not_configured',
      retryable: false,
      providerCode: 'provider_not_approved',
    })
  })

  it('redacts recipient, invite URL and token-bearing variables from audit events', () => {
    const request = buildPortalInvitationEmail(invitationInput())
    const event = toTransactionalEmailAuditEvent(request, {
      status: 'accepted',
      retryable: false,
      providerCode: 'sandbox',
      providerMessageId: 'provider-message-1',
    })
    const serialized = JSON.stringify(event)

    expect(event).toEqual({
      template: 'PORTAL_INVITATION',
      correlationId: 'qa-correlation-1',
      status: 'accepted',
      retryable: false,
      providerCode: 'sandbox',
      hasProviderMessageId: true,
    })
    expect(serialized).not.toContain('qa.portal.invitation@qa.invalid')
    expect(serialized).not.toContain(INVITATION_URL)
    expect(serialized).not.toContain('synthetic-one-time-token')
  })
})

function response(status, body = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function brevoProvider(fetch = vi.fn(), overrides = {}) {
  return {
    provider: createBrevoTransactionalEmailProvider({
      apiKey: 'brevo-test-key-not-a-secret',
      senderEmail: 'portal@costaclean.example',
      senderName: 'Costa Clean',
      replyToEmail: 'soporte@costaclean.example',
      timeoutMs: 25,
      ...overrides,
    }, {
      fetch,
      setTimeout,
      clearTimeout,
    }),
    fetch,
  }
}

describe('Brevo transactional email adapter', () => {
  it('maps a portal invitation to the documented endpoint and a static non-PII tag', async () => {
    const fetch = vi.fn().mockResolvedValue(response(201, { messageId: 'brevo-message-1' }))
    const { provider } = brevoProvider(fetch)

    await expect(provider.sendTransactionalEmail(buildPortalInvitationEmail(invitationInput()))).resolves.toEqual({
      status: 'accepted',
      providerMessageId: 'brevo-message-1',
      retryable: false,
    })

    expect(fetch).toHaveBeenCalledTimes(1)
    const [endpoint, init] = fetch.mock.calls[0]
    expect(endpoint).toBe(BREVO_TRANSACTIONAL_EMAIL_ENDPOINT)
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'api-key': 'brevo-test-key-not-a-secret', 'content-type': 'application/json' })
    const payload = JSON.parse(init.body)
    expect(payload).toMatchObject({
      sender: { email: 'portal@costaclean.example', name: 'Costa Clean' },
      replyTo: { email: 'soporte@costaclean.example' },
      to: [{ email: 'qa.portal.invitation@qa.invalid' }],
      subject: 'Tu acceso al Portal de Costa Clean',
      tags: ['portal_invitation'],
    })
    expect(payload.textContent).toContain(INVITATION_URL)
    expect(payload.htmlContent).toContain('Acceder al Portal')
    expect(payload.tags.join(',')).not.toContain('qa.portal.invitation')
    expect(payload.tags.join(',')).not.toContain('synthetic-one-time-token')
  })

  it('escapes dynamic HTML and rejects non-HTTPS non-loopback invitation URLs', async () => {
    const fetch = vi.fn().mockResolvedValue(response(201, { messageId: 'brevo-message-2' }))
    const { provider } = brevoProvider(fetch)
    const safeUrl = 'https://portal.example.invalid/invite?token=<script>&next="x"'

    await provider.sendTransactionalEmail(buildPortalInvitationEmail(invitationInput({ invitationUrl: safeUrl, expiresAt: '<b>soon</b>' })))
    const payload = JSON.parse(fetch.mock.calls[0][1].body)
    expect(payload.htmlContent).toContain('&lt;script&gt;')
    expect(payload.htmlContent).toContain('&quot;x&quot;')
    expect(payload.htmlContent).toContain('&lt;b&gt;soon&lt;/b&gt;')

    await expect(provider.sendTransactionalEmail(buildPortalInvitationEmail(invitationInput({ invitationUrl: 'javascript:alert(1)' })))).resolves.toEqual({
      status: 'rejected', retryable: false, providerCode: 'invalid_invitation_url',
    })
    await expect(provider.sendTransactionalEmail(buildPortalInvitationEmail(invitationInput({ invitationUrl: 'data:text/html,test' })))).resolves.toEqual({
      status: 'rejected', retryable: false, providerCode: 'invalid_invitation_url',
    })
    await expect(provider.sendTransactionalEmail(buildPortalInvitationEmail(invitationInput({ invitationUrl: 'file:///private/token' })))).resolves.toEqual({
      status: 'rejected', retryable: false, providerCode: 'invalid_invitation_url',
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('fails closed for missing Brevo configuration and disabled or unknown providers', async () => {
    const fetch = vi.fn()
    const invalid = createBrevoTransactionalEmailProvider({ apiKey: '', senderEmail: 'portal@costaclean.example', senderName: 'Costa Clean' }, { fetch, setTimeout, clearTimeout })
    await expect(invalid.sendTransactionalEmail(buildPortalInvitationEmail(invitationInput()))).resolves.toEqual({
      status: 'not_configured', retryable: false, providerCode: 'brevo_configuration_invalid',
    })
    await expect(createTransactionalEmailProviderFromEnvironment(() => undefined).sendTransactionalEmail(buildPortalInvitationEmail(invitationInput()))).resolves.toMatchObject({
      status: 'not_configured', providerCode: 'provider_disabled',
    })
    await expect(createTransactionalEmailProviderFromEnvironment((name) => name === 'TRANSACTIONAL_EMAIL_PROVIDER' ? 'other' : undefined).sendTransactionalEmail(buildPortalInvitationEmail(invitationInput()))).resolves.toMatchObject({
      status: 'not_configured', providerCode: 'provider_unsupported',
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('resolves Brevo only when the complete server-only configuration is present', async () => {
    const fetch = vi.fn().mockResolvedValue(response(201, { messageId: 'brevo-message-from-environment' }))
    const environment = {
      TRANSACTIONAL_EMAIL_PROVIDER: 'brevo',
      BREVO_API_KEY: 'brevo-test-key-not-a-secret',
      BREVO_SENDER_EMAIL: 'portal@costaclean.example',
      BREVO_SENDER_NAME: 'Costa Clean',
      BREVO_REPLY_TO_EMAIL: 'soporte@costaclean.example',
    }
    const provider = createTransactionalEmailProviderFromEnvironment((name) => environment[name], { fetch, setTimeout, clearTimeout })

    await expect(provider.sendTransactionalEmail(buildPortalInvitationEmail(invitationInput()))).resolves.toMatchObject({
      status: 'accepted', providerMessageId: 'brevo-message-from-environment',
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it.each([
    [400, { status: 'rejected', retryable: false, providerCode: 'invalid_request' }],
    [401, { status: 'rejected', retryable: false, providerCode: 'authentication_failed' }],
    [403, { status: 'rejected', retryable: false, providerCode: 'authorization_denied' }],
    [429, { status: 'failed', retryable: true, providerCode: 'rate_limited' }],
    [500, { status: 'failed', retryable: true, providerCode: 'provider_unavailable' }],
  ])('classifies HTTP %i without leaking provider response bodies', async (status, expected) => {
    const fetch = vi.fn().mockResolvedValue(response(status, { message: 'sensitive provider detail' }))
    const { provider } = brevoProvider(fetch)

    await expect(provider.sendTransactionalEmail(buildPortalInvitationEmail(invitationInput()))).resolves.toEqual(expected)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('classifies network failure, timeout and malformed success without transport retry', async () => {
    const networkFetch = vi.fn().mockRejectedValue(new Error('network failure'))
    await expect(brevoProvider(networkFetch).provider.sendTransactionalEmail(buildPortalInvitationEmail(invitationInput()))).resolves.toEqual({
      status: 'failed', retryable: false, providerCode: 'brevo_fetch_exception',
    })

    const timeoutFetch = vi.fn((_input, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    }))
    const timeoutProvider = createBrevoTransactionalEmailProvider({
      apiKey: 'brevo-test-key-not-a-secret', senderEmail: 'portal@costaclean.example', senderName: 'Costa Clean', timeoutMs: 1,
    }, { fetch: timeoutFetch, setTimeout, clearTimeout })
    await expect(timeoutProvider.sendTransactionalEmail(buildPortalInvitationEmail(invitationInput()))).resolves.toEqual({
      status: 'failed', retryable: false, providerCode: 'brevo_fetch_timeout',
    })

    const malformedFetch = vi.fn().mockResolvedValue(response(201, {}))
    await expect(brevoProvider(malformedFetch).provider.sendTransactionalEmail(buildPortalInvitationEmail(invitationInput()))).resolves.toEqual({
      status: 'failed', retryable: false, providerCode: 'malformed_success_response',
    })
    expect(networkFetch).toHaveBeenCalledTimes(1)
    expect(timeoutFetch).toHaveBeenCalledTimes(1)
    expect(malformedFetch).toHaveBeenCalledTimes(1)
  })

  it('keeps secrets, recipient and invitation URL out of results, audit metadata and the disconnected handler', async () => {
    const apiKey = 'brevo-test-key-not-a-secret'
    const fetch = vi.fn().mockRejectedValue(new Error('provider rejected request'))
    const { provider } = brevoProvider(fetch, { apiKey })
    const result = await provider.sendTransactionalEmail(buildPortalInvitationEmail(invitationInput()))
    const audit = toTransactionalEmailAuditEvent(buildPortalInvitationEmail(invitationInput()), result)
    const observable = JSON.stringify({ result, audit })

    expect(observable).not.toContain(apiKey)
    expect(observable).not.toContain('qa.portal.invitation@qa.invalid')
    expect(observable).not.toContain('synthetic-one-time-token')
    const memberActions = readFileSync('supabase/functions/portal-member-actions/index.ts', 'utf8')
    expect(memberActions).toContain('triggerInvitationDelivery')
    expect(memberActions).toContain("JSON.stringify({ invitationId: input.invitationId })")
    expect(memberActions).not.toContain('token: input.token')
  })
})


describe('CP-4.3C certified Brevo regressions', () => {
  it('adds the Brevo sandbox drop header only when explicitly configured', async () => {
    const fetch = vi.fn().mockResolvedValue(response(201, { messageId: 'sandbox-message-1' }))
    const environment = {
      TRANSACTIONAL_EMAIL_PROVIDER: 'brevo',
      BREVO_API_KEY: 'brevo-test-key-not-a-secret',
      BREVO_SENDER_EMAIL: 'portal@costaclean.example',
      BREVO_SENDER_NAME: 'Costa Clean',
      BREVO_REPLY_TO_EMAIL: 'soporte@costaclean.example',
      BREVO_SANDBOX_MODE: 'drop',
    }
    const provider = createTransactionalEmailProviderFromEnvironment(
      (name) => environment[name],
      { fetch, setTimeout, clearTimeout },
    )

    await expect(provider.sendTransactionalEmail(buildPortalInvitationEmail(invitationInput()))).resolves.toMatchObject({
      status: 'accepted',
      providerMessageId: 'sandbox-message-1',
    })

    const payload = JSON.parse(fetch.mock.calls[0][1].body)
    expect(payload.headers).toEqual({ 'X-Sib-Sandbox': 'drop' })
  })

  it('keeps timer calls bound to globalThis in the default Edge runtime dependencies', async () => {
    const originalFetch = globalThis.fetch
    const originalSetTimeout = globalThis.setTimeout
    const originalClearTimeout = globalThis.clearTimeout
    const timerToken = { id: 'cp43-timer' }

    globalThis.fetch = vi.fn().mockResolvedValue(response(201, { messageId: 'bound-timer-message' }))
    globalThis.setTimeout = function (callback, delay) {
      expect(this).toBe(globalThis)
      expect(typeof callback).toBe('function')
      expect(delay).toBeGreaterThan(0)
      return timerToken
    }
    globalThis.clearTimeout = function (timer) {
      expect(this).toBe(globalThis)
      expect(timer).toBe(timerToken)
    }

    try {
      const provider = createBrevoTransactionalEmailProvider({
        apiKey: 'brevo-test-key-not-a-secret',
        senderEmail: 'portal@costaclean.example',
        senderName: 'Costa Clean',
        timeoutMs: 25,
      })
      await expect(provider.sendTransactionalEmail(buildPortalInvitationEmail(invitationInput()))).resolves.toEqual({
        status: 'accepted',
        providerMessageId: 'bound-timer-message',
        retryable: false,
      })
    } finally {
      globalThis.fetch = originalFetch
      globalThis.setTimeout = originalSetTimeout
      globalThis.clearTimeout = originalClearTimeout
    }
  })
})
