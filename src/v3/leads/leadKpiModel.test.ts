import { describe, expect, it } from 'vitest'
import { buildLeadKpiCounts } from './leadKpiModel'

const lead = (id: string, status: string, archived_at: string | null = null) => ({
  id,
  display_code: id.toUpperCase(),
  full_name: id,
  phone: '600000000',
  email: null,
  city: null,
  status,
  archived_at,
  converted_client_id: null,
})

describe('buildLeadKpiCounts', () => {
  it('counts current lead states using the existing lifecycle semantics', () => {
    expect(buildLeadKpiCounts([
      lead('active-new', 'new'),
      lead('active-contacted', 'contacted'),
      lead('active-quoted', 'quoted'),
      lead('won', 'won'),
      lead('lost', 'lost'),
      lead('archived-new', 'new', '2026-09-21T10:00:00Z'),
    ])).toEqual({ active: 3, new: 1, contacted: 1, quoted: 1 })
  })

  it('returns zeroes for an empty or fully archived Leads state', () => {
    expect(buildLeadKpiCounts([])).toEqual({ active: 0, new: 0, contacted: 0, quoted: 0 })
    expect(buildLeadKpiCounts([lead('archived', 'quoted', '2026-09-21T10:00:00Z')])).toEqual({ active: 0, new: 0, contacted: 0, quoted: 0 })
  })
})
