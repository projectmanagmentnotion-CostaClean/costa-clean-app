import { useEffect, useState } from 'react'
import { appConfig } from '../app/appConfig'
import { DashboardKpis } from '../features/dashboard/DashboardKpis'
import { DashboardOverview } from '../features/dashboard/DashboardOverview'
import { DashboardQuickActions } from '../features/dashboard/DashboardQuickActions'
import type { HomePageProps } from '../features/dashboard/types'
import type { AppView } from '../app/navigation'
import { getSupabaseClient } from '../lib/supabase'

interface HomePageViewProps
  extends Omit<HomePageProps, 'connectionStatus' | 'connectionDetail'> {
  onOpenView: (view: AppView) => void
}

export function HomePage({ metrics, onOpenView }: HomePageViewProps) {
  const [connectionStatus, setConnectionStatus] = useState('Comprobando...')
  const [connectionDetail, setConnectionDetail] = useState(
    'Verificando cliente Supabase.',
  )

  useEffect(() => {
    async function checkConnection() {
      try {
        const { client, error } = getSupabaseClient()

        if (error || !client) {
          setConnectionStatus('Error de conexión')
          setConnectionDetail(error ?? 'No se pudo crear el cliente Supabase.')
          return
        }

        const { error: sessionError } = await client.auth.getSession()

        if (sessionError) {
          setConnectionStatus('Error de conexión')
          setConnectionDetail(sessionError.message)
          return
        }

        setConnectionStatus('Supabase conectado')
        setConnectionDetail('Cliente inicializado correctamente.')
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Error desconocido de conexión.'

        setConnectionStatus('Error de conexión')
        setConnectionDetail(message)
      }
    }

    void checkConnection()
  }, [])

  return (
    <section className="page-section cc-dashboard-page">
      <header className="cc-page-topline">
        <div>
          <span className="cc-page-topline__eyebrow">{appConfig.appName}</span>
          <h1 className="cc-page-topline__title">Dashboard</h1>
          <p className="cc-page-topline__text">
            Shell ejecutivo de CostaClean con navegación tipo app nativa y vista
            central del negocio.
          </p>
        </div>
      </header>

      <DashboardOverview
        metrics={metrics}
        connectionStatus={connectionStatus}
        connectionDetail={connectionDetail}
      />

      <DashboardKpis metrics={metrics} />

      <DashboardQuickActions onOpenView={onOpenView} />
    </section>
  )
}
