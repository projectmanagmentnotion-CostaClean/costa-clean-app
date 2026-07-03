import { describe, expect, it } from 'vitest'
import { normalizeClientFiscalData } from './clientFiscalData'
import { __clientWriteApiTestUtils, createClientRecord } from './clientWriteApi'
import type { ClientListItem } from './types'

function createClient(overrides: Partial<ClientListItem> = {}): ClientListItem {
  return {
    id: 'client-1',
    display_code: 'CLI-001',
    full_name: 'Miguel Angel Flores Castillo',
    phone: null,
    email: null,
    tax_id: '52755379A',
    billing_address: 'Avinguda de Lloret de Dalt, 10',
    status: 'active',
    source_lead_id: null,
    ...overrides,
  }
}

describe('clientWriteApi test utils', () => {
  it('rejects empty client ids with a controlled message', () => {
    try {
      __clientWriteApiTestUtils.normalizeClientId('   ')
      throw new Error('expected error')
    } catch (error) {
      expect(error instanceof Error ? error.message : null).toBe(
        'No se pudo actualizar el cliente porque falta el identificador.',
      )
    }
  })

  it('returns the single updated client when exactly one row is returned', () => {
    const client = createClient()
    expect(__clientWriteApiTestUtils.normalizeReturnedClientRows([client], {
      emptyMessage: 'sin filas',
      multipleMessage: 'muchas filas',
    })).toMatchObject({
      id: 'client-1',
      full_name: 'Miguel Angel Flores Castillo',
    })
  })

  it('fails when update returns zero rows', () => {
    try {
      __clientWriteApiTestUtils.normalizeReturnedClientRows([], {
        emptyMessage: 'sin filas',
        multipleMessage: 'muchas filas',
      })
      throw new Error('expected error')
    } catch (error) {
      expect(error instanceof Error ? error.message : null).toBe('sin filas')
    }
  })

  it('fails when update returns multiple rows', () => {
    try {
      __clientWriteApiTestUtils.normalizeReturnedClientRows([
        createClient({ id: 'client-1' }),
        createClient({ id: 'client-2' }),
      ], {
        emptyMessage: 'sin filas',
        multipleMessage: 'muchas filas',
      })
      throw new Error('expected error')
    } catch (error) {
      expect(error instanceof Error ? error.message : null).toBe('muchas filas')
    }
  })

  it('wraps the coercion error into a controlled write error', () => {
    const wrapped = __clientWriteApiTestUtils.toClientWriteError(
      new Error('Cannot coerce the result to a single JSON object'),
      'No se pudo actualizar el cliente. Revisa la conexion o permisos y vuelve a intentarlo.',
    )

    expect(wrapped.message).toBe('No se pudo actualizar el cliente. Revisa la conexion o permisos y vuelve a intentarlo.')
  })

  it('builds a clean update payload without undefined fields', () => {
    expect(__clientWriteApiTestUtils.buildClientPayload({
      full_name: ' Miguel Angel Flores Castillo ',
      phone: ' 674269480 ',
      email: '',
      tax_id: ' 52755379a ',
      billing_address: ' Avinguda de Lloret de Dalt, 10 ',
      status: 'active',
    })).toMatchObject({
      full_name: 'Miguel Angel Flores Castillo',
      phone: '674269480',
      email: null,
      tax_id: '52755379A',
      billing_address: 'Avinguda de Lloret de Dalt, 10',
      status: 'active',
    })
  })

  it('keeps the id inside create payloads sent to Supabase', () => {
    expect(__clientWriteApiTestUtils.buildClientPayload({
      id: 'CLIENT-123',
      full_name: ' Miguel Angel Flores Castillo ',
      status: 'active',
    })).toMatchObject({
      id: 'CLIENT-123',
      full_name: 'Miguel Angel Flores Castillo',
      status: 'active',
    })
  })

  it('masks tax ids in diagnostic logs', () => {
    expect(__clientWriteApiTestUtils.maskTaxId('52755379A')).toBe('5275***9A')
  })

  it('generates a client id automatically when a create call does not provide one', async () => {
    let fetchCallCount = 0
    let requestBody = ''
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (_input, init) => {
      fetchCallCount += 1
      requestBody = String(init?.body ?? '')

      return new Response(JSON.stringify([createClient({
        id: 'CLIENT-generated',
        full_name: 'Cristian Fernandez Perpinan',
        phone: '937655484',
        email: 'laboral@gmail.com',
        tax_id: 'B09775578',
        billing_address: 'carrer de Mar 96, Malgrat de Mar',
        status: 'active',
      })]), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const processLike = globalThis as { process?: { env?: Record<string, string | undefined> } }
    processLike.process = processLike.process ?? { env: {} }
    processLike.process.env = processLike.process.env ?? {}
    processLike.process.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
    processLike.process.env.VITE_SUPABASE_ANON_KEY = 'anon-key'

    try {
      await createClientRecord({
        full_name: '  Cristian Fernandez Perpinan  ',
        phone: ' 937655484 ',
        email: ' laboral@gmail.com ',
        tax_id: ' b09775578 ',
        billing_address: ' carrer de Mar 96, Malgrat de Mar ',
      })

      const payload = JSON.parse(requestBody) as Record<string, unknown>
      expect(fetchCallCount).toBe(1)
      expect(/^CLIENT-/.test(String(payload.id ?? ''))).toBe(true)
      expect(payload.full_name).toBe('Cristian Fernandez Perpinan')
      expect(payload.status).toBe('active')
      expect(payload.tax_id).toBe('B09775578')
      expect(payload.billing_address).toBe('carrer de Mar 96, Malgrat de Mar')
    } finally {
      globalThis.fetch = originalFetch
      delete processLike.process.env.VITE_SUPABASE_URL
      delete processLike.process.env.VITE_SUPABASE_ANON_KEY
    }
  })

  it('preserves provided historical ids during create writes', async () => {
    let requestBody = ''
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (_input, init) => {
      requestBody = String(init?.body ?? '')

      return new Response(JSON.stringify([createClient({
        id: 'HIST-CLIENT-LEGACY',
        full_name: 'Cliente historico',
        status: 'active',
      })]), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const processLike = globalThis as { process?: { env?: Record<string, string | undefined> } }
    processLike.process = processLike.process ?? { env: {} }
    processLike.process.env = processLike.process.env ?? {}
    processLike.process.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
    processLike.process.env.VITE_SUPABASE_ANON_KEY = 'anon-key'

    try {
      await createClientRecord({
        id: 'HIST-CLIENT-LEGACY',
        full_name: 'Cliente historico',
        status: 'active',
      })

      const payload = JSON.parse(requestBody) as Record<string, unknown>
      expect(payload.id).toBe('HIST-CLIENT-LEGACY')
    } finally {
      globalThis.fetch = originalFetch
      delete processLike.process.env.VITE_SUPABASE_URL
      delete processLike.process.env.VITE_SUPABASE_ANON_KEY
    }
  })

  it('translates id constraint failures into a useful message', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async () => new Response(JSON.stringify({
      code: '23502',
      message: 'null value in column "id" of relation "clients" violates not-null constraint',
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })

    const processLike = globalThis as { process?: { env?: Record<string, string | undefined> } }
    processLike.process = processLike.process ?? { env: {} }
    processLike.process.env = processLike.process.env ?? {}
    processLike.process.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
    processLike.process.env.VITE_SUPABASE_ANON_KEY = 'anon-key'

    try {
      try {
        await createClientRecord({
          id: 'CLIENT-failing',
          full_name: 'Cliente roto',
          status: 'active',
        })
        throw new Error('expected error')
      } catch (error) {
        expect(error instanceof Error ? error.message : null).toBe('No se pudo crear el cliente porque falta identificador interno.')
      }
    } finally {
      globalThis.fetch = originalFetch
      delete processLike.process.env.VITE_SUPABASE_URL
      delete processLike.process.env.VITE_SUPABASE_ANON_KEY
    }
  })
})

describe('client fiscal normalization stays aligned with writes', () => {
  it('normalizes fiscal fields into the definitive client columns', () => {
    expect(normalizeClientFiscalData({
      tax_id: ' 52755379a ',
      billing_address: ' Avinguda de Lloret de Dalt, 10 ',
    })).toMatchObject({
      tax_id: '52755379A',
      billing_address: 'Avinguda de Lloret de Dalt, 10',
    })
  })
})
