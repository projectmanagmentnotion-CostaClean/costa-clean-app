import { ClientsList } from '../features/clients/ClientsList'
import type { ClientListItem } from '../features/clients/types'

interface ClientsPageProps {
  clients: ClientListItem[]
  error: string | null
}

export function ClientsPage({ clients, error }: ClientsPageProps) {
  return (
    <section className="page-section">
      <div className="section-header">
        <h1>Clients</h1>
        <p>Vista inicial del módulo Clients conectada a Supabase.</p>
      </div>

      <ClientsList clients={clients} error={error} />
    </section>
  )
}
