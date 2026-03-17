import { useEffect, useMemo, useState } from 'react'
import { LeadCreateForm } from '../features/leads/LeadCreateForm'
import { LeadDetailCard } from '../features/leads/LeadDetailCard'
import { LeadsList } from '../features/leads/LeadsList'
import type { LeadListItem } from '../features/leads/types'
import type { ClientListItem } from '../features/clients/types'

interface LeadsPageProps {
  leads: LeadListItem[]
  clients: ClientListItem[]
  error: string | null
  onLeadCreated: () => Promise<void>
  onLeadConverted: () => Promise<void>
}

type LeadStatusFilter = 'all' | 'new' | 'contacted' | 'quoted' | 'won' | 'lost'

export function LeadsPage({
  leads,
  clients,
  error,
  onLeadCreated,
  onLeadConverted,
}: LeadsPageProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadStatusFilter>('all')
  const [showArchived, setShowArchived] = useState(false)

  const filteredLeads = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return leads.filter((lead) => {
      const matchesArchived = showArchived ? true : !lead.archived_at

      if (!matchesArchived) {
        return false
      }

      const matchesStatus =
        statusFilter === 'all' ? true : lead.status === statusFilter

      if (!matchesStatus) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      const searchableText = [
        lead.full_name,
        lead.phone,
        lead.email ?? '',
        lead.city ?? '',
        lead.id,
        lead.status,
        lead.archived_at ? 'archived' : '',
      ]
        .join(' ')
        .toLowerCase()

      return searchableText.includes(normalizedSearch)
    })
  }, [leads, searchTerm, statusFilter, showArchived])

  useEffect(() => {
    if (filteredLeads.length === 0) {
      setSelectedLeadId(null)
      return
    }

    const selectedStillExists = filteredLeads.some(
      (lead) => lead.id === selectedLeadId,
    )

    if (!selectedStillExists) {
      setSelectedLeadId(filteredLeads[0].id)
    }
  }, [filteredLeads, selectedLeadId])

  const selectedLead =
    filteredLeads.find((lead) => lead.id === selectedLeadId) ?? null

  const convertedLeadIds = useMemo(() => {
    return new Set(
      clients
        .map((client) => client.source_lead_id)
        .filter((value): value is string => Boolean(value)),
    )
  }, [clients])

  const selectedLeadAlreadyConverted = selectedLead
    ? convertedLeadIds.has(selectedLead.id)
    : false

  return (
    <section className="page-section">
      <div className="section-header page-header-actions">
        <div>
          <h1>Leads</h1>
          <p>Vista inicial del módulo Leads conectada a Supabase.</p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() => setShowCreateForm((current) => !current)}
        >
          {showCreateForm ? 'Cerrar formulario' : 'Nuevo lead'}
        </button>
      </div>

      {showCreateForm ? <LeadCreateForm onCreated={onLeadCreated} /> : null}

      <section className="data-section">
        <div className="section-header">
          <h2>Búsqueda y filtros</h2>
          <p>Encuentra leads por nombre, teléfono, ciudad o estado.</p>
        </div>

        <div className="filters-grid">
          <label className="form-field filter-field-wide">
            <span>Buscar</span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Ej. Marta, 600123123, Barcelona..."
            />
          </label>

          <label className="form-field">
            <span>Estado</span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as LeadStatusFilter)
              }
            >
              <option value="all">all</option>
              <option value="new">new</option>
              <option value="contacted">contacted</option>
              <option value="quoted">quoted</option>
              <option value="won">won</option>
              <option value="lost">lost</option>
            </select>
          </label>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
          <span>Mostrar leads archivados</span>
        </label>

        <div className="results-bar">
          <span>
            {filteredLeads.length} resultado(s) de {leads.length} lead(s)
          </span>

          {(searchTerm || statusFilter !== 'all' || showArchived) && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setSearchTerm('')
                setStatusFilter('all')
                setShowArchived(false)
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </section>

      <LeadDetailCard
        lead={selectedLead}
        alreadyConverted={selectedLeadAlreadyConverted}
        onLeadUpdated={onLeadCreated}
        onLeadConverted={onLeadConverted}
      />

      <LeadsList
        leads={filteredLeads}
        error={error}
        selectedLeadId={selectedLeadId}
        onSelectLead={(lead) => setSelectedLeadId(lead.id)}
      />
    </section>
  )
}
