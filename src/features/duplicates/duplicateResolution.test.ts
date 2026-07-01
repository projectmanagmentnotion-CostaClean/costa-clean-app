import { describe, expect, it } from 'vitest'
import { buildDuplicatePairResolutionKeys } from './duplicateResolution'
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
})
