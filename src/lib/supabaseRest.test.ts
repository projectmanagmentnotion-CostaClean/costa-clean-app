import { describe, expect, it } from 'vitest'
import {
  AUTHENTICATED_READ_SESSION_ERROR,
  fetchSupabaseRestListDetailed,
  resolveAuthenticatedReadContext,
} from './supabaseRest'

describe('authenticated Supabase REST reads', () => {
  it('rejects a missing session and the anon key as bearer', () => {
    for (const accessToken of [null, 'anon-key']) {
      let message = ''
      try {
        resolveAuthenticatedReadContext({
          supabaseUrl: 'https://example.supabase.co',
          supabaseAnonKey: 'anon-key',
          accessToken,
        })
      } catch (error) {
        message = error instanceof Error ? error.message : ''
      }
      expect(message).toBe(AUTHENTICATED_READ_SESSION_ERROR)
    }
  })

  it('uses session.access_token and keeps anon only as apikey', async () => {
    let capturedHeaders: HeadersInit | undefined

    const result = await fetchSupabaseRestListDetailed<{ id: string }>('clients?select=id', {}, {
      getContext: async () => resolveAuthenticatedReadContext({
        supabaseUrl: 'https://example.supabase.co',
        supabaseAnonKey: 'anon-key',
        accessToken: 'session-access-token',
      }),
      fetch: async (_url, init) => {
        capturedHeaders = init?.headers
        return new Response('[{"id":"client-1"}]', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]?.id).toBe('client-1')
    expect(capturedHeaders).toMatchObject({
      apikey: 'anon-key',
      Authorization: 'Bearer session-access-token',
    })
    expect((capturedHeaders as Record<string, string>).Authorization === 'Bearer anon-key').toBe(false)
  })

  it('aborts before fetch when no authenticated read context exists', async () => {
    let fetchCalls = 0

    let message = ''
    try {
      await fetchSupabaseRestListDetailed('invoices?select=id', {}, {
        getContext: async () => {
          throw new Error(AUTHENTICATED_READ_SESSION_ERROR)
        },
        fetch: async () => {
          fetchCalls += 1
          return new Response('[]', { status: 200 })
        },
      })
    } catch (error) {
      message = error instanceof Error ? error.message : ''
    }

    expect(fetchCalls).toBe(0)
    expect(message).toBe(AUTHENTICATED_READ_SESSION_ERROR)
  })
})
