import { Suspense } from 'react'
import type { ReactNode } from 'react'
import type { AppView } from './navigation'

const shellLoadingTitles: Record<AppView, string> = {
  dashboard: 'Preparando panel de control',
  alerts: 'Preparando centro de alertas',
  fiscal_closing: 'Preparando cierre fiscal',
  quarterly_closing: 'Preparando cierre fiscal',
  annual_closing: 'Preparando cierre fiscal',
  leads: 'Cargando leads',
  clients: 'Cargando clientes',
  properties: 'Cargando propiedades',
  quotes: 'Cargando presupuestos',
  jobs: 'Cargando servicios',
  invoices: 'Cargando facturas',
  expenses: 'Cargando gastos',
  payments: 'Cargando cobros',
}

function ShellLoadingState({ currentView }: { currentView: AppView }) {
  return (
    <section className="cc-shell-loading" aria-live="polite" aria-busy="true">
      <div className="cc-shell-loading__hero">
        <div className="cc-shell-loading__eyebrow" />
        <div className="cc-shell-loading__title" />
        <div className="cc-shell-loading__text" />
      </div>

      <div className="cc-shell-loading__grid">
        <article className="cc-shell-loading__card">
          <div className="cc-shell-loading__line cc-shell-loading__line--short" />
          <div className="cc-shell-loading__line cc-shell-loading__line--value" />
          <div className="cc-shell-loading__line cc-shell-loading__line--wide" />
        </article>
        <article className="cc-shell-loading__card">
          <div className="cc-shell-loading__line cc-shell-loading__line--short" />
          <div className="cc-shell-loading__line cc-shell-loading__line--value" />
          <div className="cc-shell-loading__line cc-shell-loading__line--medium" />
        </article>
        <article className="cc-shell-loading__card">
          <div className="cc-shell-loading__line cc-shell-loading__line--short" />
          <div className="cc-shell-loading__line cc-shell-loading__line--value" />
          <div className="cc-shell-loading__line cc-shell-loading__line--wide" />
        </article>
      </div>

      <div className="empty-state cc-state-card cc-state-card--loading">
        <strong>{shellLoadingTitles[currentView]}</strong>
        <p>Sincronizando datos y preparando la vista operativa.</p>
      </div>
    </section>
  )
}

interface AppShellViewRendererProps {
  currentView: AppView
  isInitialDataLoading: boolean
  children: ReactNode
}

export function AppShellViewRenderer({
  currentView,
  isInitialDataLoading,
  children,
}: AppShellViewRendererProps) {
  if (isInitialDataLoading) {
    return <ShellLoadingState currentView={currentView} />
  }

  return (
    <Suspense fallback={<ShellLoadingState currentView={currentView} />}>
      {children}
    </Suspense>
  )
}
