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
    <section className="data-section">
      <div className="section-header">
        <h2>Leads reales</h2>
        <p>Listado conectado a Supabase.</p>
      </div>

      {error ? (
        <div className="empty-state">
          <strong>Error cargando leads</strong>
          <p>{error}</p>
        </div>
      ) : leads.length === 0 ? (
        <div className="empty-state">
          <strong>No hay leads</strong>
          <p>Todavía no existen registros en la tabla leads.</p>
        </div>
      ) : (
        <div className="lead-list">
          {leads.map((lead) => {
            const isSelected = lead.id === selectedLeadId

            return (
              <button
                key={lead.id}
                type="button"
                className={
                  isSelected
                    ? 'lead-item lead-item-button selected'
                    : 'lead-item lead-item-button'
                }
                onClick={() => onSelectLead(lead)}
              >
                <div className="lead-item-top">
                  <strong>{lead.full_name}</strong>
                  <span className="lead-badge">{lead.status}</span>
                </div>

                <p>Código: {lead.display_code ?? lead.id}</p>
                <p>Teléfono: {lead.phone}</p>
                <p>Ciudad: {lead.city ?? 'Sin ciudad'}</p>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
