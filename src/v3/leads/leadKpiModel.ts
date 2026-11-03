import type { LeadListItem } from '../../features/leads/types'

export interface LeadKpiCounts {
  active: number
  new: number
  contacted: number
  quoted: number
}

function isCurrentLead(lead: LeadListItem): boolean {
  return !lead.archived_at
}

export function buildLeadKpiCounts(leads: LeadListItem[]): LeadKpiCounts {
  const currentLeads = leads.filter(isCurrentLead)

  return {
    active: currentLeads.filter((lead) => !['won', 'lost'].includes(lead.status)).length,
    new: currentLeads.filter((lead) => lead.status === 'new').length,
    contacted: currentLeads.filter((lead) => lead.status === 'contacted').length,
    quoted: currentLeads.filter((lead) => lead.status === 'quoted').length,
  }
}
