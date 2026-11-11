import { describe, expect, it } from 'vitest'
import { findClientDuplicateGroups } from '../duplicates/duplicateEngine'
import { createClientDraftId } from './clientDraftId'
import type { ClientListItem } from './types'

const existingDraftClient: ClientListItem = {
  id: 'CLIENT-DRAFT',
  display_code: 'CLI-TEST',
  full_name: 'TEST Concurrent Client',
  phone: '600000001',
  email: 'client-draft@example.invalid',
  tax_id: null,
  billing_address: 'TEST Address 1',
  status: 'active',
  source_lead_id: null,
}

describe('client draft identities', () => {
  it('allocates different persisted ids for two concurrently open create flows', () => {
    const firstFlowId = createClientDraftId()
    const secondFlowId = createClientDraftId()

    expect(firstFlowId).toMatch(/^CLIENT-/)
    expect(secondFlowId).toMatch(/^CLIENT-/)
    expect(secondFlowId).not.toBe(firstFlowId)
    expect(firstFlowId).not.toBe('CLIENT-DRAFT')
  })

  it('does not hide an existing CLIENT-DRAFT record from duplicate review', () => {
    const candidate = {
      ...existingDraftClient,
      id: createClientDraftId(),
    }

    const groups = findClientDuplicateGroups(candidate, [existingDraftClient])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.records.map((record) => record.recordId)).toEqual([
      candidate.id,
      existingDraftClient.id,
    ])
  })

  it('preserves an existing id for edit flows', () => {
    expect(createClientDraftId(' CLIENT-EXISTING ')).toBe('CLIENT-EXISTING')
  })
})
