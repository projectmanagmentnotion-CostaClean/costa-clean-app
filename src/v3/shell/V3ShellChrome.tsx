import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { AppView } from '../../app/navigation'

interface V3ShellChromeProps {
  currentView: AppView
  onChangeView: (view: AppView) => void
  onBack: () => void
  backTargetView: AppView | null
  accountLabel: string
  isSigningOut: boolean
  onSignOut: () => Promise<unknown>
  children?: ReactElement
}

type V3IconName = 'home' | 'invoice' | 'clients' | 'jobs' | 'quotes' | 'leads' | 'payments' | 'expenses' | 'alerts' | 'closing' | 'properties' | 'more'

const primaryItems: Array<{ view: AppView; label: string; icon: V3IconName }> = [
  { view: 'dashboard', label: 'Inicio', icon: 'home' },
  { view: 'invoices', label: 'Facturas', icon: 'invoice' },
  { view: 'clients', label: 'Clientes', icon: 'clients' },
  { view: 'jobs', label: 'Servicios', icon: 'jobs' },
]

const secondaryItems: Array<{ view: AppView; label: string; icon: V3IconName }> = [
  { view: 'quotes', label: 'Presupuestos', icon: 'quotes' },
  { view: 'leads', label: 'Leads', icon: 'leads' },
  { view: 'payments', label: 'Cobros', icon: 'payments' },
  { view: 'expenses', label: 'Gastos', icon: 'expenses' },
  { view: 'alerts', label: 'Alertas', icon: 'alerts' },
  { view: 'fiscal_closing', label: 'Cierres', icon: 'closing' },
  { view: 'properties', label: 'Inmuebles', icon: 'properties' },
]

function V3NavIcon({ name }: { name: V3IconName }) {
  const paths: Record<V3IconName, string> = {
    home: 'M3 10.5 12 3l9 7.5M5 9v11h14V9M9 20v-6h6v6', invoice: 'M6 3h9l3 3v15H6zM9 11h6M9 15h6', clients: 'M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM16 3.1a4 4 0 0 1 0 7.8M20 20v-2a4 4 0 0 0-3-3.9', jobs: 'M4 5h16v14H4zM8 3v4M16 3v4M4 10h16', quotes: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5', leads: 'M12 20V10M7 20V4M17 20v-7M4 4h6M14 13h6', payments: 'M12 3v18M17 7.5c0-1.4-1.9-2.5-4.5-2.5S8 6.1 8 7.5 9.9 10 12.5 10s4.5 1.1 4.5 2.5-1.9 2.5-4.5 2.5S8 13.9 8 12.5', expenses: 'M4 5h16v14H4zM8 9h8M8 13h5', alerts: 'M12 4 3 20h18L12 4ZM12 10v4M12 17h.01', closing: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5', properties: 'M3 20V9l9-6 9 6v11M7 20v-6h10v6', more: 'M5 12h.01M12 12h.01M19 12h.01',
  }
  return <svg aria-hidden="true" className="v3-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"><path d={paths[name]} /></svg>
}

function isActive(view: AppView, currentView: AppView): boolean {
  if (view === currentView) return true
  return view === 'fiscal_closing' && (currentView === 'annual_closing' || currentView === 'quarterly_closing')
}

function V3TopBar({ currentView, onBack, backTargetView }: Pick<V3ShellChromeProps, 'currentView' | 'onBack' | 'backTargetView'>) {
  const title = primaryItems.find((item) => item.view === currentView)?.label
    ?? secondaryItems.find((item) => item.view === currentView)?.label
    ?? (currentView === 'dashboard' ? 'Inicio' : 'CostaClean')

  return (
    <header className="v3-top-bar">
      <div className="v3-top-bar__leading">
        {currentView !== 'dashboard' ? (
          <button type="button" className="v3-top-bar__back" onClick={onBack} aria-label={backTargetView ? 'Volver' : 'Ir al inicio'}>
            ←
          </button>
        ) : null}
        <div>
          <span className="v3-top-bar__eyebrow">CostaClean</span>
          <strong>{title}</strong>
        </div>
      </div>
      <span className="v3-top-bar__mark" aria-hidden="true">CC</span>
    </header>
  )
}

function V3MoreSheet({ currentView, onChangeView, accountLabel, isSigningOut, onSignOut, onClose }: Pick<V3ShellChromeProps, 'currentView' | 'onChangeView' | 'accountLabel' | 'isSigningOut' | 'onSignOut'> & { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <>
      <button type="button" className="v3-more-sheet__backdrop" onClick={onClose} aria-label="Cerrar Más" />
      <section id="v3-more-sheet" className="v3-more-sheet" role="dialog" aria-modal="true" aria-label="Más módulos">
        <div className="v3-more-sheet__handle" aria-hidden="true" />
        <div className="v3-more-sheet__header">
          <div><span>Más</span><h2>Accesos rápidos</h2></div>
          <button ref={closeRef} type="button" className="v3-action v3-action--secondary" onClick={onClose}>Cerrar</button>
        </div>
        <div className="v3-more-sheet__grid">
          {secondaryItems.map((item) => (
            <button
              key={item.view}
              type="button"
              className={`v3-more-sheet__item${isActive(item.view, currentView) ? ' is-active' : ''}`}
              onClick={() => { onClose(); onChangeView(item.view) }}
              aria-current={isActive(item.view, currentView) ? 'page' : undefined}
            >
              <V3NavIcon name={item.icon} /><strong>{item.label}</strong>
            </button>
          ))}
        </div>
        <div className="v3-more-sheet__account">
          <span>{accountLabel}</span>
          <button type="button" className="v3-action v3-action--ghost" onClick={() => void onSignOut()} disabled={isSigningOut}>
            {isSigningOut ? 'Cerrando…' : 'Cerrar sesión'}
          </button>
        </div>
      </section>
    </>
  )
}

function V3BottomNav({ currentView, onChangeView, onOpenMore, isMoreOpen }: Pick<V3ShellChromeProps, 'currentView' | 'onChangeView'> & { onOpenMore: () => void; isMoreOpen: boolean }) {
  const isSecondaryContext = secondaryItems.some((item) => isActive(item.view, currentView))
  return (
    <nav className="v3-bottom-nav" aria-label="Navegación principal">
      {primaryItems.map((item) => (
        <button key={item.view} type="button" className={isActive(item.view, currentView) ? 'is-active' : ''} onClick={() => onChangeView(item.view)} aria-current={isActive(item.view, currentView) ? 'page' : undefined}>
          <V3NavIcon name={item.icon} /><small>{item.label}</small>
        </button>
      ))}
      <button type="button" className={isMoreOpen || isSecondaryContext ? 'is-active' : ''} onClick={onOpenMore} aria-expanded={isMoreOpen} aria-controls="v3-more-sheet">
        <V3NavIcon name="more" /><small>Más</small>
      </button>
    </nav>
  )
}

function V3NavigationRail({ currentView, onChangeView, onOpenMore, isMoreOpen }: Pick<V3ShellChromeProps, 'currentView' | 'onChangeView'> & { onOpenMore: () => void; isMoreOpen: boolean }) {
  const isSecondaryContext = secondaryItems.some((item) => isActive(item.view, currentView))
  return <nav className="v3-navigation-rail" aria-label="Navegación principal para iPad">
    <span className="v3-navigation-rail__mark" aria-hidden="true">CC</span>
    {primaryItems.map((item) => <button key={item.view} type="button" className={isActive(item.view, currentView) ? 'is-active' : ''} onClick={() => onChangeView(item.view)} aria-current={isActive(item.view, currentView) ? 'page' : undefined}><V3NavIcon name={item.icon} /><small>{item.label}</small></button>)}
    <button type="button" className={isMoreOpen || isSecondaryContext ? 'is-active' : ''} onClick={onOpenMore} aria-expanded={isMoreOpen} aria-controls="v3-more-sheet"><V3NavIcon name="more" /><small>Más</small></button>
  </nav>
}

export function V3ShellChrome(props: V3ShellChromeProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  return (
    <>
      <V3TopBar currentView={props.currentView} onBack={props.onBack} backTargetView={props.backTargetView} />
      {props.children}
      <V3BottomNav currentView={props.currentView} onChangeView={props.onChangeView} onOpenMore={() => setIsMoreOpen(true)} isMoreOpen={isMoreOpen} />
      <V3NavigationRail currentView={props.currentView} onChangeView={props.onChangeView} onOpenMore={() => setIsMoreOpen(true)} isMoreOpen={isMoreOpen} />
      {isMoreOpen ? <V3MoreSheet currentView={props.currentView} onChangeView={props.onChangeView} accountLabel={props.accountLabel} isSigningOut={props.isSigningOut} onSignOut={props.onSignOut} onClose={() => setIsMoreOpen(false)} /> : null}
    </>
  )
}
