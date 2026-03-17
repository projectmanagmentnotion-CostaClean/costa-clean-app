import { useEffect, useState } from 'react'
import { appConfig } from '../app/appConfig'
import { appModules } from '../app/modules'
import type { LeadListItem } from '../features/leads/types'
import { getSupabaseClient } from '../lib/supabase'

interface HomePageProps {
  leads: LeadListItem[]
}

export function HomePage({ leads }: HomePageProps) {
  const [connectionStatus, setConnectionStatus] = useState('Comprobando...')
  const [connectionDetail, setConnectionDetail] = useState('Verificando cliente Supabase.')

  const envUrl = import.meta.env.VITE_SUPABASE_URL
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY

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
    <section className="page-section">
      <span className="eyebrow">{appConfig.appName}</span>
      <h1>Dashboard</h1>
      <p className="hero-text">
        Vista inicial del sistema con estado técnico y resumen comercial.
      </p>

      <div className="status-grid">
        <article className="status-card">
          <span className="status-label">Estado</span>
          <strong>Proyecto inicializado</strong>
        </article>

        <article className="status-card">
          <span className="status-label">Stack</span>
          <strong>React + Vite + TypeScript</strong>
        </article>

        <article className="status-card">
          <span className="status-label">Versión</span>
          <strong>{appConfig.appVersion}</strong>
        </article>

        <article className="status-card status-card-wide">
          <span className="status-label">Conexión Supabase</span>
          <strong>{connectionStatus}</strong>
          <p className="status-detail">{connectionDetail}</p>
        </article>

        <article className="status-card">
          <span className="status-label">Diagnóstico ENV</span>
          <strong>URL: {envUrl ? 'OK' : 'VACÍA'}</strong>
          <p className="status-detail">KEY: {envKey ? 'OK' : 'VACÍA'}</p>
        </article>

        <article className="status-card status-card-wide">
          <span className="status-label">Leads en base de datos</span>
          <strong>{leads.length} lead(s) encontrados</strong>
          <p className="status-detail">
            {leads[0]
              ? `Último lead: ${leads[0].full_name} · ${leads[0].phone} · ${leads[0].city ?? 'Sin ciudad'} · ${leads[0].status}`
              : 'No hay leads todavía.'}
          </p>
        </article>
      </div>

      <div className="modules-section">
        <div className="modules-header">
          <h2>Módulos del sistema</h2>
          <p>Mapa funcional oficial de CostaClean CRM.</p>
        </div>

        <div className="modules-grid">
          {appModules.map((module) => (
            <article key={module.key} className="module-card">
              <div className="module-top">
                <span className="module-phase">{module.phase.toUpperCase()}</span>
                <span className="module-state">
                  {module.enabled ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <h3>{module.label}</h3>
              <p>{module.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
