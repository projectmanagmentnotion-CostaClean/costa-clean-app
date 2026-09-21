import { describe, expect, it } from 'vitest'
import { normalizeClientFiscalData } from './clientFiscalData'
import { __clientWriteApiTestUtils } from './clientWriteApi'
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

  it('generates client ids without depending on the REST table path', () => {
    expect(/^CLIENT-/.test(__clientWriteApiTestUtils.createClientId())).toBe(true)
  })

  it('routes client creates through the authenticated RPC and preserves historical ids', () => {
    const request = __clientWriteApiTestUtils.buildClientRpcWrite('create', null, {
      id: 'HIST-CLIENT-LEGACY',
      full_name: 'Cliente historico',
      status: 'active',
    })

    expect(request.path).toBe('rpc/create_client')
    expect(request.path.includes('/clients')).toBe(false)
    expect(request.body.p_client.id).toBe('HIST-CLIENT-LEGACY')
  })

  it('routes client updates through a separate authenticated RPC with an exact id', () => {
    const request = __clientWriteApiTestUtils.buildClientRpcWrite('update', 'client-1', {
      phone: '600000000',
    })

    expect(request.path).toBe('rpc/update_client')
    expect(request.body.p_client).toMatchObject({ id: 'client-1', phone: '600000000' })
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
