import { useMemo, useRef, useState } from 'react'
import { getStatusLabel } from '../../app/displayText'
import type { ClientListItem } from '../../features/clients/types'
import type { LeadDraftRecord } from '../../features/leadDrafts/types'
import type { LeadListItem } from '../../features/leads/types'
import type { QuoteListItem } from '../../features/quotes/types'
import { V3EntityList, V3Kpi, V3KpiGroup, V3Page, V3PageTitle, V3PrimaryAction, V3Search } from '../components/V3Primitives'
import { readLeadDeepLink } from '../navigation/leadDeepLink'
import { V3LeadRow } from './V3LeadRow'
import { V3LeadWorkspace } from './V3LeadWorkspace'

type LeadFilter = 'all' | 'new' | 'contacted' | 'quoted' | 'won' | 'lost' | 'archived'

interface V3LeadsPageProps {
  leads: LeadListItem[]
  leadDrafts: LeadDraftRecord[]
  clients: ClientListItem[]
  quotes: QuoteListItem[]
  error: string | null
  initialLeadId?: string | null
  onCreateLead: () => void
  onRefresh: () => Promise<void>
  onOpenQuote: (quoteId: string) => void
  onOpenClient: (clientId: string) => void
  onOpenLeadDeepLink: (leadId: string) => void
  onBackToLeadList: () => void
}

function matchingDraft(lead: LeadListItem, drafts: LeadDraftRecord[]): LeadDraftRecord | null {
  return drafts.find((draft) => draft.matched_lead_id === lead.id || draft.intake_submission_id === lead.public_intake_last_submission_id) ?? null
}

export function V3LeadsPage(props: V3LeadsPageProps) {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(props.initialLeadId ?? (typeof window !== 'undefined' ? readLeadDeepLink(window.location.search) : null))
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<LeadFilter>('all')
  const listScrollYRef = useRef(0)
  const visibleLeads = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return props.leads.filter((lead) => {
      const archived = Boolean(lead.archived_at)
      if (filter === 'archived' ? !archived : archived) return false
      if (filter !== 'all' && filter !== 'archived' && lead.status !== filter) return false
      if (!query) return true
      return [lead.full_name, lead.phone, lead.email, lead.city, lead.display_code, lead.id, lead.status, getStatusLabel(lead.status)].filter(Boolean).join(' ').toLocaleLowerCase().includes(query)
    })
  }, [filter, props.leads, search])
  const selectedLead = props.leads.find((lead) => lead.id === selectedLeadId) ?? null
  const selectedClient = selectedLead ? props.clients.find((client) => client.source_lead_id === selectedLead.id || client.id === selectedLead.converted_client_id) ?? null : null
  const selectedQuotes = selectedLead ? props.quotes.filter((quote) => quote.lead_id === selectedLead.id) : []
  const open = props.leads.filter((lead) => !lead.archived_at && !['won', 'lost'].includes(lead.status)).length
  const newCount = props.leads.filter((lead) => !lead.archived_at && lead.status === 'new').length
  const quotedCount = props.leads.filter((lead) => !lead.archived_at && lead.status === 'quoted').length

  function openLead(leadId: string) {
    listScrollYRef.current = window.scrollY
    setSelectedLeadId(leadId)
    props.onOpenLeadDeepLink(leadId)
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }))
  }

  function closeLead() {
    setSelectedLeadId(null)
    props.onBackToLeadList()
    window.requestAnimationFrame(() => window.scrollTo({ top: listScrollYRef.current, behavior: 'auto' }))
  }

  if (selectedLead) return <V3LeadWorkspace lead={selectedLead} draft={matchingDraft(selectedLead, props.leadDrafts)} quotes={selectedQuotes} client={selectedClient} onBack={closeLead} onRefresh={props.onRefresh} onOpenQuote={props.onOpenQuote} onOpenClient={props.onOpenClient} />

  return <V3Page className="v3-leads-page">
    <V3PageTitle eyebrow="Pipeline comercial" title="Leads" description="Oportunidades, intake y siguiente acción comercial." action={<V3PrimaryAction onClick={props.onCreateLead}>+ Nuevo</V3PrimaryAction>} />
    <V3KpiGroup><V3Kpi label="Activos" value={String(open)} hint="Oportunidades abiertas" /><V3Kpi label="Nuevos" value={String(newCount)} hint="Estado new" /><V3Kpi label="Presupuestados" value={String(quotedCount)} hint="Estado quoted" /></V3KpiGroup>
    <div className="v3-leads-controls"><V3Search value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, teléfono, email, ciudad o código" /><span className="v3-leads-count">{visibleLeads.length} visibles</span></div>
    <div className="v3-filter-tabs" role="tablist" aria-label="Estado de lead">{([['all', 'Todos'], ['new', 'Nuevos'], ['contacted', 'Contactados'], ['quoted', 'Presupuestados'], ['won', 'Ganados'], ['lost', 'Perdidos'], ['archived', 'Archivados']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={filter === value} className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div>
    {props.error ? <div className="v3-state v3-state--error" role="alert"><strong>Error cargando leads</strong><p>{props.error}</p></div> : null}
    {!props.error && visibleLeads.length === 0 ? <div className="v3-state"><strong>Sin leads visibles</strong><p>Ajusta la búsqueda o el estado para continuar.</p></div> : null}
    <V3EntityList label="Leads">{visibleLeads.map((lead) => <V3LeadRow key={lead.id} lead={lead} onOpen={() => openLead(lead.id)} />)}</V3EntityList>
  </V3Page>
}
