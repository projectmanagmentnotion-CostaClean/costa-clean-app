import { useCallback, useEffect, useState } from 'react'
import { AppNav } from './AppNav'
import type { AppView } from './navigation'
import { HomePage } from '../pages/HomePage'
import { LeadsPage } from '../pages/LeadsPage'
import { ClientsPage } from '../pages/ClientsPage'
import { PropertiesPage } from '../pages/PropertiesPage'
import type { LeadListItem } from '../features/leads/types'
import type { ClientListItem } from '../features/clients/types'
import type { PropertyListItem } from '../features/properties/types'

export function AppShell() {
  const [currentView, setCurrentView] = useState<AppView>('dashboard')
  const [leads, setLeads] = useState<LeadListItem[]>([])
  const [clients, setClients] = useState<ClientListItem[]>([])
  const [properties, setProperties] = useState<PropertyListItem[]>([])
  const [leadError, setLeadError] = useState<string | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)
  const [propertyError, setPropertyError] = useState<string | null>(null)

  const loadLeads = useCallback(async () => {
    try {
      setLeadError(null)

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        setLeadError('Faltan las variables de entorno de Supabase.')
        return
      }

      const response = await fetch(
        `${supabaseUrl}/rest/v1/leads?select=id,full_name,phone,email,city,status,archived_at&order=created_at.desc`,
        {
          method: 'GET',
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
        },
      )

      if (!response.ok) {
        setLeadError(`REST ${response.status}: ${response.statusText}`)
        return
      }

      const data = (await response.json()) as LeadListItem[]
      setLeads(data ?? [])
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido cargando leads.'

      setLeadError(message)
    }
  }, [])

  const loadClients = useCallback(async () => {
    try {
      setClientError(null)

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        setClientError('Faltan las variables de entorno de Supabase.')
        return
      }

      const response = await fetch(
        `${supabaseUrl}/rest/v1/clients?select=id,full_name,phone,email,status,source_lead_id&order=created_at.desc`,
        {
          method: 'GET',
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
        },
      )

      if (!response.ok) {
        setClientError(`REST ${response.status}: ${response.statusText}`)
        return
      }

      const data = (await response.json()) as ClientListItem[]
      setClients(data ?? [])
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido cargando clients.'

      setClientError(message)
    }
  }, [])

  const loadProperties = useCallback(async () => {
    try {
      setPropertyError(null)

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        setPropertyError('Faltan las variables de entorno de Supabase.')
        return
      }

      const response = await fetch(
        `${supabaseUrl}/rest/v1/properties?select=id,client_id,name,property_type,address,city,postal_code&order=created_at.desc`,
        {
          method: 'GET',
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
        },
      )

      if (!response.ok) {
        setPropertyError(`REST ${response.status}: ${response.statusText}`)
        return
      }

      const data = (await response.json()) as PropertyListItem[]
      setProperties(data ?? [])
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido cargando properties.'

      setPropertyError(message)
    }
  }, [])

  const reloadLeadsAndClients = useCallback(async () => {
    await Promise.all([loadLeads(), loadClients()])
  }, [loadLeads, loadClients])

  useEffect(() => {
    void Promise.all([loadLeads(), loadClients(), loadProperties()])
  }, [loadLeads, loadClients, loadProperties])

  return (
    <main className="app-shell">
      <section className="hero-card">
        <AppNav currentView={currentView} onChangeView={setCurrentView} />

        {currentView === 'dashboard' ? (
          <HomePage leads={leads} />
        ) : currentView === 'leads' ? (
          <LeadsPage
            leads={leads}
            clients={clients}
            error={leadError}
            onLeadCreated={loadLeads}
            onLeadConverted={reloadLeadsAndClients}
          />
        ) : currentView === 'clients' ? (
          <ClientsPage
            clients={clients}
            error={clientError}
            onClientCreated={loadClients}
          />
        ) : (
          <PropertiesPage
            properties={properties}
            clients={clients}
            error={propertyError}
            onPropertyCreated={loadProperties}
          />
        )}
      </section>
    </main>
  )
}
