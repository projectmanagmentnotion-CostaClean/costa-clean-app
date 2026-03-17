import type { ClientListItem } from './types'

interface ClientsListProps {
  clients: ClientListItem[]
  error: string | null
}

export function ClientsList({ clients, error }: ClientsListProps) {
  return (
    <section className="data-section">
      <div className="section-header">
        <h2>Clientes reales</h2>
        <p>Primer listado conectado a Supabase.</p>
      </div>

      {error ? (
        <div className="empty-state">
          <strong>Error cargando clientes</strong>
          <p>{error}</p>
        </div>
      ) : clients.length === 0 ? (
        <div className="empty-state">
          <strong>No hay clientes</strong>
          <p>Todavía no existen registros en la tabla clients.</p>
        </div>
      ) : (
        <div className="lead-list">
          {clients.map((client) => (
            <article key={client.id} className="lead-item">
              <div className="lead-item-top">
                <strong>{client.full_name}</strong>
                <span className="lead-badge">{client.status}</span>
              </div>

              <p>ID: {client.id}</p>
              <p>Teléfono: {client.phone ?? 'Sin teléfono'}</p>
              <p>Email: {client.email ?? 'Sin email'}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
