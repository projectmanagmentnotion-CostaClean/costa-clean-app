import { describe, expect, it } from 'vitest'
import {
  AUTHENTICATED_WRITE_SESSION_ERROR,
  buildAuthenticatedSupabaseWriteRequest,
  fetchAuthenticatedSupabaseWrite,
  getAuthenticatedWriteResponseError,
  readSingleAuthenticatedWriteRow,
  resolveAuthenticatedWriteContext,
} from './authenticatedSupabaseWrite'

describe('authenticatedSupabaseWrite', () => {
  it('uses the authenticated session token for property writes and keeps anon only as apikey', () => {
    const request = buildAuthenticatedSupabaseWriteRequest({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon-key',
      accessToken: 'property-session-token',
      path: 'properties',
      init: { method: 'POST' },
    })

    expect(request.url).toBe('https://example.supabase.co/rest/v1/properties')
    expect(request.init.headers).toMatchObject({
      apikey: 'anon-key',
      Authorization: 'Bearer property-session-token',
    })
    expect(request.init.headers.Authorization === 'Bearer anon-key').toBe(false)
  })

  it('uses the authenticated session token for service status writes and keeps anon only as apikey', () => {
    const request = buildAuthenticatedSupabaseWriteRequest({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon-key',
      accessToken: 'service-session-token',
      path: 'jobs?id=eq.job-1',
      init: { method: 'PATCH' },
    })

    expect(request.url).toBe('https://example.supabase.co/rest/v1/jobs?id=eq.job-1')
    expect(request.init.headers).toMatchObject({
      apikey: 'anon-key',
      Authorization: 'Bearer service-session-token',
    })
    expect(request.init.headers.Authorization === 'Bearer anon-key').toBe(false)
  })

  it('blocks writes when there is no authenticated session token', () => {
    let errorMessage = ''
    try {
      resolveAuthenticatedWriteContext({
        supabaseUrl: 'https://example.supabase.co',
        supabaseAnonKey: 'anon-key',
        accessToken: null,
      })
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : ''
    }

    expect(errorMessage).toBe(AUTHENTICATED_WRITE_SESSION_ERROR)
  })

  it('aborts before fetch when the current Supabase session is missing', async () => {
    let fetchCalls = 0
    let errorMessage = ''

    try {
      await fetchAuthenticatedSupabaseWrite('properties', { method: 'POST' }, {
        getContext: async () => resolveAuthenticatedWriteContext({
          supabaseUrl: 'https://example.supabase.co',
          supabaseAnonKey: 'anon-key',
          accessToken: null,
        }),
        fetch: async () => {
          fetchCalls += 1
          return new Response(null, { status: 204 })
        },
      })
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : ''
    }

    expect(errorMessage).toBe(AUTHENTICATED_WRITE_SESSION_ERROR)
    expect(fetchCalls).toBe(0)
  })

  it('reads session.access_token before executing the protected write', async () => {
    let capturedUrl = ''
    let capturedInit: RequestInit | undefined

    await fetchAuthenticatedSupabaseWrite('jobs?id=eq.job-1', { method: 'PATCH' }, {
      getContext: async () => resolveAuthenticatedWriteContext({
        supabaseUrl: 'https://example.supabase.co',
        supabaseAnonKey: 'anon-key',
        accessToken: 'live-session-token',
      }),
      fetch: async (url, init) => {
        capturedUrl = String(url)
        capturedInit = init
        return new Response(null, { status: 204 })
      },
    })

    expect(capturedUrl).toBe('https://example.supabase.co/rest/v1/jobs?id=eq.job-1')
    expect(capturedInit?.method).toBe('PATCH')
    expect(capturedInit?.headers as Record<string, string>).toMatchObject({
      apikey: 'anon-key',
      Authorization: 'Bearer live-session-token',
    })
  })

  it('keeps 401 and 403 status details in clear UX errors', async () => {
    const unauthorized = await getAuthenticatedWriteResponseError(new Response('JWT expired', {
      status: 401,
      statusText: 'Unauthorized',
    }))
    const forbidden = await getAuthenticatedWriteResponseError(new Response('RLS denied', {
      status: 403,
      statusText: 'Forbidden',
    }))

    expect(unauthorized.message.includes('sesion ha caducado')).toBe(true)
    expect(unauthorized.message.includes('REST 401: JWT expired')).toBe(true)
    expect(forbidden.message.includes('REST 403: RLS denied')).toBe(true)
  })

  it('rejects successful REST responses that affected zero rows', async () => {
    let errorMessage = ''
    try {
      await readSingleAuthenticatedWriteRow(new Response('[]', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }), 'No se actualizo ninguna fila.')
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : ''
    }

    expect(errorMessage).toBe('No se actualizo ninguna fila.')
  })

  it('returns the single persisted row from a represented write', async () => {
    const row = await readSingleAuthenticatedWriteRow<{ id: string }>(new Response('[{"id":"row-1"}]', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }), 'No se actualizo ninguna fila.')

    expect(row).toMatchObject({ id: 'row-1' })
  })
})
