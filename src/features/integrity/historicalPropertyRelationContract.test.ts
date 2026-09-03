import { describe, expect, it } from 'vitest'

type RelationInput = {
  currentPropertyClient: string
  documentClient: string | null
  documentProperty: string | null
  existingClient?: string | null
  existingProperty?: string | null
  existingCreatedAt?: string | null
  ownershipChangedAt?: string | null
}

function allowsRelation(input: RelationInput) {
  if (!input.documentClient || !input.documentProperty) return true
  if (input.currentPropertyClient === input.documentClient) return true
  return Boolean(
    input.existingClient === input.documentClient &&
      input.existingProperty === input.documentProperty &&
      input.existingCreatedAt &&
      input.ownershipChangedAt &&
      input.ownershipChangedAt > input.existingCreatedAt,
  )
}

describe('historical property relation contract', () => {
  const a = 'client-a'
  const b = 'client-b'
  const p = 'property-p'

  it('allows a new matching quote', () => expect(allowsRelation({ currentPropertyClient: a, documentClient: a, documentProperty: p })).toBe(true))
  it('rejects a new mismatching quote', () => expect(allowsRelation({ currentPropertyClient: b, documentClient: a, documentProperty: p })).toBe(false))
  it('allows a quote without property', () => expect(allowsRelation({ currentPropertyClient: b, documentClient: a, documentProperty: null })).toBe(true))
  it('allows a historical quote after reassignment', () => expect(allowsRelation({ currentPropertyClient: b, documentClient: a, documentProperty: p, existingClient: a, existingProperty: p, existingCreatedAt: '2026-01-01', ownershipChangedAt: '2026-02-01' })).toBe(true))
  it('allows a historical job after reassignment', () => expect(allowsRelation({ currentPropertyClient: b, documentClient: a, documentProperty: p, existingClient: a, existingProperty: p, existingCreatedAt: '2026-01-01', ownershipChangedAt: '2026-02-01' })).toBe(true))
  it('allows a historical invoice after reassignment', () => expect(allowsRelation({ currentPropertyClient: b, documentClient: a, documentProperty: p, existingClient: a, existingProperty: p, existingCreatedAt: '2026-01-01', ownershipChangedAt: '2026-02-01' })).toBe(true))
  it('allows non-relational edits when the historical pair is preserved', () => expect(allowsRelation({ currentPropertyClient: b, documentClient: a, documentProperty: p, existingClient: a, existingProperty: p, existingCreatedAt: '2026-01-01', ownershipChangedAt: '2026-02-01' })).toBe(true))
  it('rejects changing a historical document to an incompatible pair', () => expect(allowsRelation({ currentPropertyClient: b, documentClient: a, documentProperty: 'property-q', existingClient: a, existingProperty: p, existingCreatedAt: '2026-01-01', ownershipChangedAt: '2026-02-01' })).toBe(false))
  it('rejects duplicating a historical pair after reassignment', () => expect(allowsRelation({ currentPropertyClient: b, documentClient: a, documentProperty: p })).toBe(false))
  it('rejects a new invoice from an old quote after reassignment', () => expect(allowsRelation({ currentPropertyClient: b, documentClient: a, documentProperty: p })).toBe(false))
})
