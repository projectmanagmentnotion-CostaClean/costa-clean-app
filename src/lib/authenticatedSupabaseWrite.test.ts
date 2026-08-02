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
      path: 'rpc/create_property',
      init: { method: 'POST' },
    })

    expect(request.url).toBe('https://example.supabase.co/rest/v1/rpc/create_property')
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
      path: 'rpc/update_job_status',
      init: { method: 'POST' },
    })

    expect(request.url).toBe('https://example.supabase.co/rest/v1/rpc/update_job_status')
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

  it('blocks the anon key from being reused as an authenticated bearer', () => {
    let errorMessage = ''
    try {
      resolveAuthenticatedWriteContext({
        supabaseUrl: 'https://example.supabase.co',
        supabaseAnonKey: 'anon-key',
        accessToken: 'anon-key',
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
      await fetchAuthenticatedSupabaseWrite('rpc/create_property', { method: 'POST' }, {
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

    await fetchAuthenticatedSupabaseWrite('rpc/update_job_status', { method: 'POST' }, {
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

    expect(capturedUrl).toBe('https://example.supabase.co/rest/v1/rpc/update_job_status')
    expect(capturedInit?.method).toBe('POST')
    expect(capturedInit?.headers as Record<string, string>).toMatchObject({
      apikey: 'anon-key',
      Authorization: 'Bearer live-session-token',
    })
  })

  it('refreshes the session and retries once when Supabase rejects an expired token', async () => {
    const authorizationHeaders: string[] = []
    let fetchCalls = 0
    let refreshCalls = 0

    const response = await fetchAuthenticatedSupabaseWrite('rpc/create_client', {
      method: 'POST',
      body: JSON.stringify({ p_client: { id: 'CLIENT-1', full_name: 'Cliente' } }),
    }, {
      getContext: async () => resolveAuthenticatedWriteContext({
        supabaseUrl: 'https://example.supabase.co',
        supabaseAnonKey: 'anon-key',
        accessToken: 'expired-session-token',
      }),
      refreshContext: async () => {
        refreshCalls += 1
        return resolveAuthenticatedWriteContext({
          supabaseUrl: 'https://example.supabase.co',
          supabaseAnonKey: 'anon-key',
          accessToken: 'refreshed-session-token',
        })
      },
      fetch: async (_url, init) => {
        fetchCalls += 1
        authorizationHeaders.push((init?.headers as Record<string, string>).Authorization)
        return fetchCalls === 1
          ? new Response('JWT expired', { status: 401, statusText: 'Unauthorized' })
          : new Response(null, { status: 204 })
      },
    })

    expect(response.status).toBe(204)
    expect(fetchCalls).toBe(2)
    expect(refreshCalls).toBe(1)
    expect(authorizationHeaders).toEqual([
      'Bearer expired-session-token',
      'Bearer refreshed-session-token',
    ])
  })

  it('does not retry permission failures that are unrelated to token expiry', async () => {
    let fetchCalls = 0
    let refreshCalls = 0
    let errorMessage = ''

    try {
      await fetchAuthenticatedSupabaseWrite('rpc/create_client', { method: 'POST' }, {
        getContext: async () => resolveAuthenticatedWriteContext({
          supabaseUrl: 'https://example.supabase.co',
          supabaseAnonKey: 'anon-key',
          accessToken: 'live-session-token',
        }),
        refreshContext: async () => {
          refreshCalls += 1
          return resolveAuthenticatedWriteContext({
            supabaseUrl: 'https://example.supabase.co',
            supabaseAnonKey: 'anon-key',
            accessToken: 'unexpected-refreshed-token',
          })
        },
        fetch: async () => {
          fetchCalls += 1
          return new Response('RLS denied', { status: 403, statusText: 'Forbidden' })
        },
      })
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : ''
    }

    expect(errorMessage.includes('REST 403: RLS denied')).toBe(true)
    expect(fetchCalls).toBe(1)
    expect(refreshCalls).toBe(0)
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
