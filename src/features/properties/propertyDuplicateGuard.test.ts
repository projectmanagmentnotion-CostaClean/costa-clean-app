import { describe, expect, it } from 'vitest'
import { buildPropertyDuplicateKey, comparePropertyCandidates, normalizePropertyFingerprint } from './propertyDuplicateGuard'
import { buildClientPropertyOptions, mergePropertyOptions } from './propertyOptionSync'
import type { PropertyListItem } from './types'

function createProperty(overrides: Partial<PropertyListItem> = {}): PropertyListItem {
  return {
    id: overrides.id ?? 'PROPERTY-1',
    display_code: overrides.display_code ?? null,
    client_id: overrides.client_id ?? 'CLIENT-1',
    client_display_code: overrides.client_display_code ?? null,
    client_name: overrides.client_name ?? 'Cliente Demo',
    name: overrides.name ?? 'Piso Centro',
    property_type: overrides.property_type ?? 'apartment',
    address: overrides.address ?? 'Carrer Major 10, 2 1',
    city: overrides.city ?? 'Calella',
    postal_code: overrides.postal_code ?? '08370',
    notes: overrides.notes ?? null,
  }
}

describe('propertyDuplicateGuard', () => {
  it('normalizes address and name into a stable fingerprint', () => {
    expect(normalizePropertyFingerprint(createProperty({
      name: '  Piso  Céntró ',
      address: 'Calle Major, num. 10 2º 1ª',
    }))).toMatchObject({
      clientId: 'client-1',
      name: 'piso centro',
      address: 'major 10 2º 1ª',
      city: 'calella',
      postalCode: '08370',
      propertyType: 'apartment',
    })
  })

  it('builds a duplicate key scoped to the client', () => {
    expect(buildPropertyDuplicateKey(createProperty())).toBe('client-1::major 10 2 1::piso centro::calella::08370::apartment')
  })

  it('detects a duplicate for the same client', () => {
    const reasons = comparePropertyCandidates(
      createProperty(),
      createProperty({ id: 'PROPERTY-2', name: 'Piso centro', address: 'Carrer Major 10 2 1' }),
    )

    expect(reasons.map((reason) => reason.code).join(',')).toBe(
      'property-client-address,property-address-zone,property-client-name',
    )
  })

  it('does not flag the same address across different clients', () => {
    expect(comparePropertyCandidates(
      createProperty(),
      createProperty({ id: 'PROPERTY-2', client_id: 'CLIENT-2' }),
    )).toHaveLength(0)
  })
})

describe('propertyOptionSync', () => {
  it('adds a created property to the available options without duplicating persisted items', () => {
    const base = [createProperty({ id: 'PROPERTY-1' })]
    const created = [createProperty({ id: 'PROPERTY-2', name: 'Local Nuevo' })]

    expect(buildClientPropertyOptions(base, created, 'CLIENT-1').map((property) => property.id).join(',')).toBe('PROPERTY-1,PROPERTY-2')
    expect(mergePropertyOptions(base, created).map((property) => property.id).join(',')).toBe('PROPERTY-1,PROPERTY-2')
  })

  it('keeps the created property id ready to be selected', () => {
    expect(createProperty({ id: 'PROPERTY-99' }).id).toBe('PROPERTY-99')
  })
})
