import { useCallback, useEffect, useState } from 'react'
import { AppNav } from './AppNav'
import type { AppView } from './navigation'
import { HomePage } from '../pages/HomePage'
import { LeadsPage } from '../pages/LeadsPage'
import type { LeadListItem } from '../features/leads/types'

export function AppShell() {
  const [currentView, setCurrentView] = useState<AppView>('dashboard')
  const [leads, setLeads] = useState<LeadListItem[]>([])
  const [leadError, setLeadError] = useState<string | null>(null)

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
        `${supabaseUrl}/rest/v1/leads?select=id,full_name,phone,city,status,archived_at&order=created_at.desc`,
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

  useEffect(() => {
    void loadLeads()
  }, [loadLeads])

  return (
    <main className="app-shell">
      <section className="hero-card">
        <AppNav currentView={currentView} onChangeView={setCurrentView} />

        {currentView === 'dashboard' ? (
          <HomePage leads={leads} />
        ) : (
          <LeadsPage leads={leads} error={leadError} onLeadCreated={loadLeads} />
        )}
      </section>
    </main>
  )
}
