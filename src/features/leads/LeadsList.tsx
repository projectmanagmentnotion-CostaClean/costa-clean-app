import { DSEmptyState } from '../../design-system/components/DSEmptyState'
import { DSErrorState } from '../../design-system/components/DSErrorState'
import { getStatusLabel } from '../../app/displayText'
import type { LeadListItem } from './types'

interface LeadsListProps {
  leads: LeadListItem[]
  error: string | null
  selectedLeadId: string | null
  onSelectLead: (lead: LeadListItem) => void
}

export function LeadsList({
  leads,
  error,
  selectedLeadId,
  onSelectLead,
}: LeadsListProps) {
  return (
    <section className="data-section cc-module-list-section">
      <div className="section-header cc-list-section__header">
        <div>
          <h2>Leads</h2>
          <p>Entrada comercial, contacto y paso a conversion.</p>
        </div>
        <span className="cc-list-section__count">
          {leads.length} / {leads.length}
        </span>
      </div>

      {error ? (
        <DSErrorState title="Error cargando leads" description={error} />
      ) : leads.length === 0 ? (
        <DSEmptyState title="No hay leads" description="Todavia no existen registros en la tabla leads." />
      ) : (
        <div className="lead-list cc-record-list cc-bounded-list">
          {leads.map((lead) => {
            const isSelected = lead.id === selectedLeadId

            return (
              <button
                key={lead.id}
                type="button"
                className={
                  isSelected
                    ? 'lead-item lead-item-button selected cc-record-card cc-record-card--lead'
                    : 'lead-item lead-item-button cc-record-card cc-record-card--lead'
                }
                onClick={() => onSelectLead(lead)}
              >
                <div className="cc-record-card__head">
                  <div className="cc-record-card__identity">
                    <strong className="cc-record-card__title">{lead.full_name}</strong>
                    <span className="cc-record-card__subref">{lead.display_code ?? lead.id}</span>
                  </div>

                  <div className="cc-record-card__aside">
                    <span className={`lead-badge cc-status-badge cc-status-badge--${lead.status}`}>{getStatusLabel(lead.status)}</span>
                  </div>
                </div>

                <p className="cc-record-card__summary">{lead.city ?? 'Sin ciudad registrada'}</p>

                <div className="cc-record-card__chips" aria-label="Contexto del lead">
                  <span className="cc-record-card__chip">{lead.phone}</span>
                  <span className="cc-record-card__chip">{lead.email ?? 'Sin email'}</span>
                </div>

                <div className="cc-list-meta cc-record-card__meta">
                  <span>
                    <span className="cc-record-card__meta-label">Codigo</span>
                    <span className="cc-record-card__meta-value">{lead.display_code ?? lead.id}</span>
                  </span>
                  <span>
                    <span className="cc-record-card__meta-label">Ciudad</span>
                    <span className="cc-record-card__meta-value">{lead.city ?? 'Sin ciudad'}</span>
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
