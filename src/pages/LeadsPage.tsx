import { useMemo, useState } from 'react'
import { getStatusLabel } from '../app/displayText'
import { ListToolbar, type ListPreferences } from '../components/ListToolbar'
import type { ClientListItem } from '../features/clients/types'
import { DuplicateNotice } from '../features/duplicates/DuplicateNotice'
import { useDuplicateResolution } from '../features/duplicates/duplicateResolution'
import { DuplicateReviewOverlay } from '../features/duplicates/DuplicateReviewOverlay'
import { buildLeadDuplicateGroups } from '../features/duplicates/duplicateEngine'
import type { LeadDraftRecord } from '../features/leadDrafts/types'
import { LeadCreateForm } from '../features/leads/LeadCreateForm'
import { LeadDetailCard } from '../features/leads/LeadDetailCard'
import { LeadsList } from '../features/leads/LeadsList'
import { compareText, createDefaultPreferences } from '../features/lists/listPreferences'
import { applyTextSearch, recentFirstSort } from '../features/lists/utils'
import type { LeadListItem } from '../features/leads/types'

interface LeadsPageProps {
  leads: LeadListItem[]
  leadDrafts: LeadDraftRecord[]
  clients: ClientListItem[]
  error: string | null
  onLeadCreated: () => Promise<void>
  onLeadConverted: () => Promise<void>
}

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
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [showDuplicateReview, setShowDuplicateReview] = useState(false)
  const defaultPreferences = useMemo(() => createDefaultPreferences('recent', 'desc', {
    status: 'all',
    scope: 'active',
  }), [])
  const [preferences, setPreferences] = useState<ListPreferences>(defaultPreferences)

  const filteredLeads = useMemo(() => {
    const statusFilter = preferences.filters.status ?? 'all'
    const scope = preferences.filters.scope ?? 'active'

    return leads.filter((lead) => {
      const isArchived = Boolean(lead.archived_at)
      const isDeleted = Boolean(lead.deleted_at)

      if (isDeleted) return false
      if (scope === 'active' && isArchived) return false
      if (scope === 'archived' && !isArchived) return false
      if (statusFilter !== 'all' && lead.status !== statusFilter) return false

      return applyTextSearch(preferences.searchQuery, [
        lead.full_name,
        lead.phone,
        lead.email,
        lead.city,
        lead.id,
        lead.display_code,
        lead.status,
        getStatusLabel(lead.status),
        isArchived ? 'archivado' : 'activo',
      ])
    }).sort((left, right) => {
      const comparison = preferences.sortField === 'name'
        ? compareText(left.full_name, right.full_name)
        : preferences.sortField === 'city'
          ? compareText(left.city, right.city)
          : recentFirstSort(left.display_code ?? left.id, right.display_code ?? right.id)

      return preferences.sortDirection === 'asc' ? comparison : -comparison
    })
  }, [leads, preferences])

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
        <ListToolbar
          storageKey="costaclean-list-preferences-leads"
          searchLabel="Buscar lead"
          searchPlaceholder="Nombre, codigo, telefono, email, ciudad o estado"
          resultCount={filteredLeads.length}
          totalCount={leads.length}
          sortOptions={[
            { value: 'recent', label: 'Recientes' },
            { value: 'name', label: 'Nombre' },
            { value: 'city', label: 'Ciudad' },
          ]}
          defaultPreferences={defaultPreferences}
          filters={[
            {
              key: 'status',
              label: 'Estado',
              value: preferences.filters.status ?? 'all',
              options: [
                { value: 'all', label: 'Todos' },
                { value: 'new', label: getStatusLabel('new') },
                { value: 'contacted', label: getStatusLabel('contacted') },
                { value: 'quoted', label: getStatusLabel('quoted') },
                { value: 'won', label: getStatusLabel('won') },
                { value: 'lost', label: getStatusLabel('lost') },
              ],
            },
            {
              key: 'scope',
              label: 'Vista',
              value: preferences.filters.scope ?? 'active',
              options: [
                { value: 'active', label: 'Activos' },
                { value: 'archived', label: 'Archivados' },
                { value: 'all', label: 'Todos' },
              ],
            },
          ]}
          onChange={setPreferences}
        />
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
