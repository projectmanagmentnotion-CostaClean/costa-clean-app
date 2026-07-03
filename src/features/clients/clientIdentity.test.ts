import { describe, expect, it } from 'vitest'
import {
  createClientId,
  normalizeClientInput,
  normalizeClientStatus,
  trimNullable,
} from './clientIdentity'

describe('clientIdentity', () => {
  it('creates prefixed client ids for new records', () => {
    expect(/^CLIENT-/.test(createClientId())).toBe(true)
  })

  it('normalizes create payloads and generates an id when missing', () => {
    const payload = normalizeClientInput({
      full_name: '  Cristian Fernandez Perpinan  ',
      phone: ' 937655484 ',
      email: ' laboral@gmail.com ',
      tax_id: ' b09775578 ',
      billing_address: ' carrer de Mar 96, Malgrat de Mar ',
      status: '',
    })

    expect(payload).toMatchObject({
      full_name: 'Cristian Fernandez Perpinan',
      phone: '937655484',
      email: 'laboral@gmail.com',
      tax_id: 'B09775578',
      billing_address: 'carrer de Mar 96, Malgrat de Mar',
      status: 'active',
      source_lead_id: null,
    })
    expect(/^CLIENT-/.test(payload.id)).toBe(true)
  })

  it('preserves historical ids provided by imports or migrations', () => {
    expect(normalizeClientInput({
      id: 'HIST-CLIENT-0001',
      full_name: 'Cliente historico',
      status: 'inactive',
    })).toMatchObject({
      id: 'HIST-CLIENT-0001',
      full_name: 'Cliente historico',
      status: 'inactive',
    })
  })

  it('rejects missing client names before any write', () => {
    try {
      normalizeClientInput({
        full_name: '   ',
      })
      throw new Error('expected error')
    } catch (error) {
      expect(error instanceof Error ? error.message : null).toBe('Debes indicar el nombre completo del cliente.')
    }
  })

  it('normalizes helper primitives consistently', () => {
    expect(trimNullable('  ')).toBeNull()
    expect(trimNullable(' abc ')).toBe('abc')
    expect(normalizeClientStatus(undefined)).toBe('active')
    expect(normalizeClientStatus(' INACTIVE ')).toBe('inactive')
  })
})
