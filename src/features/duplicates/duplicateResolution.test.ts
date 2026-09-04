import { describe, expect, it } from 'vitest'
import { buildDuplicateFingerprint, buildDuplicatePairResolutionKeys } from './duplicateResolution'
import type { DuplicateGroup } from './types'

describe('duplicateResolution', () => {
  it('builds stable pair keys for every record pair in a group', () => {
    const group: DuplicateGroup<{ id: string }> = {
      entityType: 'invoice',
      groupId: 'invoice-a-b-c',
      severity: 'strong',
      reasons: [
        { code: 'same-client', label: 'Cliente', severity: 'strong' },
        { code: 'same-total', label: 'Importe', severity: 'probable' },
      ],
      records: [
        { entityType: 'invoice', record: { id: 'b' }, recordId: 'b', reasons: [], severity: 'strong', summary: { title: 'B', subtitle: 'B', meta: [], facts: [] } },
        { entityType: 'invoice', record: { id: 'a' }, recordId: 'a', reasons: [], severity: 'strong', summary: { title: 'A', subtitle: 'A', meta: [], facts: [] } },
        { entityType: 'invoice', record: { id: 'c' }, recordId: 'c', reasons: [], severity: 'strong', summary: { title: 'C', subtitle: 'C', meta: [], facts: [] } },
      ],
    }

    expect(JSON.stringify(buildDuplicatePairResolutionKeys(group))).toBe(JSON.stringify([
      'invoice__a__b__same-client::same-total',
      'invoice__a__c__same-client::same-total',
      'invoice__b__c__same-client::same-total',
    ]))
  })

  it('builds the same fingerprint regardless of record order', () => {
    const base: DuplicateGroup<{ id: string }> = {
      entityType: 'property',
      groupId: 'property-a-b',
      severity: 'probable',
      reasons: [{ code: 'same-address', label: 'Direccion', severity: 'probable' }],
      records: [
        { entityType: 'property', record: { id: 'a' }, recordId: 'a', reasons: [], severity: 'probable', summary: { title: 'A', subtitle: 'A', meta: [], facts: [] } },
        { entityType: 'property', record: { id: 'b' }, recordId: 'b', reasons: [], severity: 'probable', summary: { title: 'B', subtitle: 'B', meta: [], facts: [] } },
      ],
    }

    expect(buildDuplicateFingerprint(base)).toBe('property__a__b__same-address')
    expect(buildDuplicateFingerprint({ ...base, records: [...base.records].reverse() })).toBe(buildDuplicateFingerprint(base))
  })
})
