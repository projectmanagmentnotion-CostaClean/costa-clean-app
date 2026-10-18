import { describe, expect, it } from 'vitest'
import {
  AUTHENTICATED_READ_SESSION_ERROR,
  fetchSupabaseRestList,
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

  it('reads every bounded REST page instead of accepting a truncated first page', async () => {
    const sourceRows = Array.from({ length: 1001 }, (_, index) => ({ id: `row-${index + 1}` }))
    const requestedRanges: string[] = []
    const rows = await fetchSupabaseRestList<{ id: string }>('invoices?select=id', {}, {
      getContext: async () => resolveAuthenticatedReadContext({
        supabaseUrl: 'https://example.supabase.co',
        supabaseAnonKey: 'anon-key',
        accessToken: 'session-access-token',
      }),
      fetch: async (_url, init) => {
        const headers = init?.headers as Record<string, string>
        const range = headers.Range
        requestedRanges.push(range)
        const [from, to] = range.split('-').map(Number)
        return new Response(JSON.stringify(sourceRows.slice(from, to + 1)), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    })

    expect(rows).toHaveLength(1001)
    expect(rows[0]?.id).toBe('row-1')
    expect(rows.at(-1)?.id).toBe('row-1001')
    expect(requestedRanges).toEqual(['0-499', '500-999', '1000-1499'])
  })

  it('fails closed if the REST endpoint repeats a full page and ignores ranges', async () => {
    const repeatedRows = Array.from({ length: 500 }, (_, index) => ({ id: `row-${index}` }))
    let fetchCalls = 0
    await expect(fetchSupabaseRestList('invoices?select=id', {}, {
      getContext: async () => resolveAuthenticatedReadContext({
        supabaseUrl: 'https://example.supabase.co',
        supabaseAnonKey: 'anon-key',
        accessToken: 'session-access-token',
      }),
      fetch: async () => {
        fetchCalls += 1
        return new Response(JSON.stringify(repeatedRows), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    })).rejects.toThrow('La paginación REST no avanzó')
    expect(fetchCalls).toBe(2)
  })

  it('deduplicates rows overlapping page boundaries during concurrent inserts', async () => {
    const sourceRows = Array.from({ length: 1001 }, (_, index) => ({ id: `row-${index + 1}` }))
    let fetchCalls = 0
    let resolvedOrder: string | null = null
    const rows = await fetchSupabaseRestList<{ id: string }>('invoices?select=id&order=created_at.desc', {}, {
      getContext: async () => resolveAuthenticatedReadContext({
        supabaseUrl: 'https://example.supabase.co',
        supabaseAnonKey: 'anon-key',
        accessToken: 'session-access-token',
      }),
      fetch: async (input) => {
        fetchCalls += 1
        resolvedOrder ??= new URL(String(input)).searchParams.get('order')
        const page = fetchCalls === 1
          ? sourceRows.slice(0, 500)
          : fetchCalls === 2
            ? sourceRows.slice(499, 999)
            : sourceRows.slice(999)
        return new Response(JSON.stringify(page), { status: 200, headers: { 'Content-Type': 'application/json' } })
      },
    })

    expect(rows).toHaveLength(1001)
    expect(new Set(rows.map((row) => row.id)).size).toBe(1001)
    expect(resolvedOrder).toBe('created_at.desc,id.asc')
  })
})
