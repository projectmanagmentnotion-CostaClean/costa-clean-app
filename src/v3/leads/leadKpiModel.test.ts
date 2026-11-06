import { describe, expect, it } from 'vitest'
import type { LeadListItem } from '../../features/leads/types'
import { buildLeadKpiCounts } from './leadKpiModel'

function lead(id: string, status: string, archived_at: string | null = null): LeadListItem {
  return { id, display_code: id, full_name: id, phone: '', email: null, city: null, status, archived_at }
}

describe('buildLeadKpiCounts', () => {
  it('counts active pipeline states and excludes archived records', () => {
    expect(buildLeadKpiCounts([
      lead('new', 'new'),
      lead('contacted', 'contacted'),
      lead('quoted', 'quoted'),
      lead('won', 'won'),
      lead('lost', 'lost'),
      lead('archived-new', 'new', '2026-10-01'),
    ])).toEqual({ active: 3, new: 1, contacted: 1, quoted: 1 })
  })

  it('returns zero counts for an empty pipeline', () => {
    expect(buildLeadKpiCounts([])).toEqual({ active: 0, new: 0, contacted: 0, quoted: 0 })
  })
})
