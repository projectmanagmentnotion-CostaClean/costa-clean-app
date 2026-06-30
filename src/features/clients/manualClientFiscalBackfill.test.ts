import { describe, expect, it } from 'vitest'
import {
  buildManualClientFiscalBackfillPlan,
  manualClientFiscalEntries,
} from './manualClientFiscalBackfill'
import type { ClientListItem } from './types'

function createClient(overrides: Partial<ClientListItem> = {}): ClientListItem {
  return {
    id: 'client-1',
    display_code: 'CLI-001',
    full_name: 'Pink Elephant SL',
    phone: null,
    email: null,
    tax_id: null,
    billing_address: null,
    status: 'inactive',
    source_lead_id: null,
    ...overrides,
  }
}

describe('manual client fiscal backfill', () => {
  it('completes missing tax id and billing address and sets active status', () => {
    const client = createClient()
    const plan = buildManualClientFiscalBackfillPlan([client], manualClientFiscalEntries)

    expect(plan.updates).toHaveLength(1)
    expect(plan.updates[0]).toMatchObject({
      clientId: 'client-1',
      clientName: 'Pink Elephant SL',
      referenceName: 'Pink Elephant SL',
      nextTaxId: 'B44857639',
      nextBillingAddress: 'C/Passeig de Sant Pol, 97, 17220 Sant Feliu de Guixols',
      appliedFields: ['tax_id', 'billing_address', 'status'],
    })
  })

  it('does not modify full_name and leaves already complete records unchanged', () => {
    const client = createClient({
      tax_id: 'B44857639',
      billing_address: 'C/Passeig de Sant Pol, 97, 17220 Sant Feliu de Guixols',
      status: 'active',
    })
    const plan = buildManualClientFiscalBackfillPlan([client], manualClientFiscalEntries)

    expect(plan.updates).toHaveLength(0)
    expect(plan.unchanged).toHaveLength(1)
    expect(plan.unchanged[0]).toMatchObject({
      clientName: 'Pink Elephant SL',
      referenceName: 'Pink Elephant SL',
    })
  })

  it('does not overwrite a different existing tax id', () => {
    const client = createClient({
      tax_id: 'OTHER-TAX-ID',
    })
    const plan = buildManualClientFiscalBackfillPlan([client], manualClientFiscalEntries)

    expect(plan.updates).toHaveLength(0)
    expect(plan.conflicts).toHaveLength(1)
    expect(plan.conflicts[0]).toMatchObject({
      field: 'tax_id',
      currentValue: 'OTHER-TAX-ID',
      incomingValue: 'B44857639',
    })
  })

  it('does not overwrite a different existing billing address', () => {
    const client = createClient({
      billing_address: 'Otra direccion',
    })
    const plan = buildManualClientFiscalBackfillPlan([client], manualClientFiscalEntries)

    expect(plan.updates).toHaveLength(0)
    expect(plan.conflicts).toHaveLength(1)
    expect(plan.conflicts[0]).toMatchObject({
      field: 'billing_address',
      currentValue: 'Otra direccion',
      incomingValue: 'C/Passeig de Sant Pol, 97, 17220 Sant Feliu de Guixols',
    })
  })

  it('detects not found clients without creating new ones', () => {
    const plan = buildManualClientFiscalBackfillPlan([createClient()], manualClientFiscalEntries)
    const notFound = plan.notFound.find((entry) => entry.referenceName === 'JOSEFA LLAS GRANOT')

    expect(notFound).toMatchObject({
      referenceName: 'JOSEFA LLAS GRANOT',
      possibleClientNames: [],
    })
  })

  it('matches safely ignoring accents and case when the name is otherwise exact', () => {
    const client = createClient({
      full_name: 'GURI, TEIXIDÓ I ASSOCIATS SL',
    })

    const plan = buildManualClientFiscalBackfillPlan([client], [manualClientFiscalEntries[6]])

    expect(plan.updates).toHaveLength(1)
    expect(plan.updates[0]).toMatchObject({
      clientName: 'GURI, TEIXIDÓ I ASSOCIATS SL',
      referenceName: 'GURI, TEIXIDO I ASSOCIATS SL',
    })
  })

  it('detects ambiguous matches', () => {
    const clients = [
      createClient({ id: 'client-a', full_name: 'Pink Elephant SL' }),
      createClient({ id: 'client-b', display_code: 'CLI-002', full_name: 'Pink Elephant SL' }),
    ]

    const plan = buildManualClientFiscalBackfillPlan(clients, [manualClientFiscalEntries[1]])

    expect(plan.updates).toHaveLength(0)
    expect(plan.conflicts).toHaveLength(2)
    expect(plan.conflicts[0]).toMatchObject({
      field: 'match',
      possibleClientNames: ['Pink Elephant SL', 'Pink Elephant SL'],
    })
  })
})
