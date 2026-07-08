import { Suspense, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppView } from './navigation'
import { DSPageLoading } from '../design-system/components/DSPageLoading'

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
  const [showRows, setShowRows] = useState(false)

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setShowRows(true)
    }, 240)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [currentView])

  return (
    <DSPageLoading
      title={shellLoadingTitles[currentView]}
      description="Sincronizando la vista operativa sin ocupar mas espacio que la lectura real."
      mode={showRows ? 'page' : 'inline'}
      rows={showRows ? 3 : 0}
    />
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
