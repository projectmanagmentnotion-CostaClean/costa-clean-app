import type { LeadListItem } from '../../features/leads/types'

export interface LeadKpiCounts {
  active: number
  new: number
  contacted: number
  quoted: number
}

export function buildLeadKpiCounts(leads: LeadListItem[]): LeadKpiCounts {
  const activeLeads = leads.filter((lead) => !lead.archived_at)

  return {
    active: activeLeads.filter((lead) => !['won', 'lost'].includes(lead.status)).length,
    new: activeLeads.filter((lead) => lead.status === 'new').length,
    contacted: activeLeads.filter((lead) => lead.status === 'contacted').length,
    quoted: activeLeads.filter((lead) => lead.status === 'quoted').length,
  }
}
