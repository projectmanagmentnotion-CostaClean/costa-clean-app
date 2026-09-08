import type { LeadListItem } from '../../features/leads/types'
import { getStatusLabel } from '../../app/displayText'
import { V3EntityListItem, V3Status } from '../components/V3Primitives'

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'won') return 'success'
  if (status === 'contacted' || status === 'quoted') return 'warning'
  if (status === 'lost') return 'danger'
  return 'neutral'
}

export function V3LeadRow({ lead, onOpen }: { lead: LeadListItem; onOpen: () => void }) {
  return (
    <V3EntityListItem onClick={onOpen} ariaLabel={`Abrir lead ${lead.full_name}`}>
      <div className="v3-lead-row__main">
        <strong>{lead.full_name}</strong>
        <span>{lead.display_code ?? lead.id} · {lead.city ?? lead.phone}</span>
      </div>
      <div className="v3-lead-row__side">
        <V3Status label={getStatusLabel(lead.status)} tone={statusTone(lead.status)} />
        <small>{lead.email ?? lead.phone}</small>
      </div>
    </V3EntityListItem>
  )
}
