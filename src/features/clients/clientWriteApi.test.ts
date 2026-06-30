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
