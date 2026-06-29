import { useMemo, useState } from 'react'
import { getStatusLabel } from '../app/displayText'
import type { ClientListItem } from '../features/clients/types'
import { DuplicateNotice } from '../features/duplicates/DuplicateNotice'
import { useDuplicateResolution } from '../features/duplicates/duplicateResolution'
import { DuplicateReviewOverlay } from '../features/duplicates/DuplicateReviewOverlay'
import { buildLeadDuplicateGroups } from '../features/duplicates/duplicateEngine'
import type { LeadDraftRecord } from '../features/leadDrafts/types'
import { LeadCreateForm } from '../features/leads/LeadCreateForm'
import { LeadDetailCard } from '../features/leads/LeadDetailCard'
import { LeadsList } from '../features/leads/LeadsList'
import type { LeadListItem } from '../features/leads/types'

interface LeadsPageProps {
  leads: LeadListItem[]
  leadDrafts: LeadDraftRecord[]
  clients: ClientListItem[]
  error: string | null
  onLeadCreated: () => Promise<void>
  onLeadConverted: () => Promise<void>
}

type LeadStatusFilter = 'all' | 'new' | 'contacted' | 'quoted' | 'won' | 'lost'

const visibleLeadDraftStatuses = new Set<LeadDraftRecord['status']>([
  'new',
  'matched_existing_lead',
  'ready_for_review',
  'converted',
])

function sameId(left: string | null | undefined, right: string | null | undefined): boolean {
  return Boolean(left && right && left.trim() === right.trim())
}

function isVisibleDraftForLead(draft: LeadDraftRecord, lead: LeadListItem): boolean {
  if (!visibleLeadDraftStatuses.has(draft.status)) return false

  return (
    sameId(draft.matched_lead_id, lead.id) ||
    sameId(draft.intake_submission_id, lead.public_intake_last_submission_id)
  )
}

export function LeadsPage({
  leads,
  leadDrafts,
  clients,
  error,
  onLeadCreated,
  onLeadConverted,
}: LeadsPageProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<LeadStatusFilter>('all')
  const [showArchived, setShowArchived] = useState(false)
  const [showDuplicateReview, setShowDuplicateReview] = useState(false)

  const filteredLeads = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return leads.filter((lead) => {
      const matchesArchived = showArchived ? true : !lead.archived_at
      if (!matchesArchived) return false

      const matchesStatus =
        statusFilter === 'all' ? true : lead.status === statusFilter
      if (!matchesStatus) return false

      if (!normalizedSearch) return true

      const searchableText = [
        lead.full_name,
        lead.phone,
        lead.email ?? '',
        lead.city ?? '',
        lead.id,
        lead.status,
        getStatusLabel(lead.status),
        lead.archived_at ? 'archivado' : '',
      ]
        .join(' ')
        .toLowerCase()

      return searchableText.includes(normalizedSearch)
    })
  }, [leads, searchTerm, statusFilter, showArchived])

  const selectedLead =
    filteredLeads.find((lead) => lead.id === selectedLeadId) ?? filteredLeads[0] ?? null
  const selectedLeadKey = selectedLead?.id ?? null
  const selectedLeadDraft = useMemo(() => {
    if (!selectedLead) return null

    return leadDrafts.find((draft) => isVisibleDraftForLead(draft, selectedLead)) ?? null
  }, [leadDrafts, selectedLead])

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
  const hasActiveFilters = Boolean(searchTerm || statusFilter !== 'all' || showArchived)
  const visibleLeadsCount = filteredLeads.length
  const newLeadsCount = leads.filter((lead) => lead.status === 'new' && !lead.archived_at).length
  const quotedLeadsCount = leads.filter((lead) => lead.status === 'quoted' && !lead.archived_at).length
  const wonLeadsCount = leads.filter((lead) => lead.status === 'won' && !lead.archived_at).length
  const rawDuplicateGroups = useMemo(() => buildLeadDuplicateGroups(leads), [leads])
  const {
    visibleGroups: duplicateGroups,
    reviewStateByGroupId,
    markReviewed,
    ignoreGroup,
    reopenGroup,
  } = useDuplicateResolution(rawDuplicateGroups)

  return (
    <section className="page-section cc-master-page">
      <div className="section-header page-header-actions cc-master-page__hero">
        <div className="cc-module-hero__body">
          <span className="cc-module-hero__eyebrow">Pipeline comercial</span>
          <h1>Leads</h1>
          <p>Gestiona oportunidades comerciales, seguimiento y conversion a cliente.</p>

          <div className="cc-module-hero__meta" aria-label="Resumen del modulo leads">
            <span className="cc-module-hero__metric">
              <strong>{visibleLeadsCount}</strong>
              <span>visibles</span>
            </span>
            <span className="cc-module-hero__metric">
              <strong>{newLeadsCount}</strong>
              <span>nuevos</span>
            </span>
            <span className="cc-module-hero__metric">
              <strong>{quotedLeadsCount}</strong>
              <span>presupuestados</span>
            </span>
            <span className="cc-module-hero__metric">
              <strong>{wonLeadsCount}</strong>
              <span>ganados</span>
            </span>
          </div>
        </div>

        <div className="cc-module-hero__actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => setShowCreateForm((current) => !current)}
          >
            {showCreateForm ? 'Cerrar formulario' : 'Nuevo lead'}
          </button>
        </div>
      </div>

      {duplicateGroups.length > 0 ? (
        <DuplicateNotice
          title={`${duplicateGroups.length} grupo(s) de posibles leads duplicados`}
          description="Se han detectado coincidencias por teléfono, email o contexto comercial. Revísalas desde una surface corta antes de seguir ampliando el pipeline."
          actionLabel="Revisar duplicados"
          onAction={() => setShowDuplicateReview(true)}
        />
      ) : null}

      {showCreateForm ? (
        <LeadCreateForm
          onCreated={onLeadCreated}
          existingLeads={leads}
          onOpenExistingLead={(leadId) => {
            setShowCreateForm(false)
            setSelectedLeadId(leadId)
          }}
        />
      ) : null}

      <section className="data-section cc-filters-block">
        <details
          className="cc-filters-panel cc-collapsible-section"
          open={showFilters}
          onToggle={(event) => setShowFilters(event.currentTarget.open)}
        >
          <summary className="cc-filters-panel__summary cc-collapsible-section__summary">
            <div className="cc-filters-panel__copy">
              <strong>Busqueda y filtros</strong>
              <span>
                {hasActiveFilters
                  ? 'Filtros activos en leads'
                  : 'Ocultos para mantener la vista compacta'}
              </span>
            </div>
            {hasActiveFilters ? <span className="cc-filters-panel__badge">Activos</span> : null}
          </summary>

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
                <option value="all">Todos</option>
                <option value="new">{getStatusLabel('new')}</option>
                <option value="contacted">{getStatusLabel('contacted')}</option>
                <option value="quoted">{getStatusLabel('quoted')}</option>
                <option value="won">{getStatusLabel('won')}</option>
                <option value="lost">{getStatusLabel('lost')}</option>
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

          {hasActiveFilters ? (
            <div className="cc-filters-panel__actions">
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
            </div>
          ) : null}
        </details>

        <div className="results-bar">
          <span>
            {filteredLeads.length} resultado(s) de {leads.length} lead(s)
          </span>
        </div>
      </section>

      <div className="cc-master-layout cc-master-layout--list-first">
        <div className="cc-master-layout__list">
          <LeadsList
            leads={filteredLeads}
            error={error}
            selectedLeadId={selectedLeadKey}
            onSelectLead={(lead) => setSelectedLeadId(lead.id)}
          />
        </div>

        <div className="cc-master-layout__detail">
          <LeadDetailCard
            lead={selectedLead}
            leadDraft={selectedLeadDraft}
            alreadyConverted={selectedLeadAlreadyConverted}
            onLeadUpdated={onLeadCreated}
            onLeadConverted={onLeadConverted}
          />
        </div>
      </div>

      <DuplicateReviewOverlay
        isOpen={showDuplicateReview}
        title="Revisión de leads duplicados"
        description="Estas coincidencias ya existen en la app. Úsalas para decidir si conviene unificar o seguir tratando cada lead por separado."
        groups={duplicateGroups}
        reviewStateByGroupId={reviewStateByGroupId}
        onMarkReviewed={markReviewed}
        onIgnoreGroup={ignoreGroup}
        onReopenGroup={reopenGroup}
        onClose={() => setShowDuplicateReview(false)}
        onOpenRecord={(leadId) => {
          setShowDuplicateReview(false)
          setSelectedLeadId(leadId)
        }}
      />
    </section>
  )
}
