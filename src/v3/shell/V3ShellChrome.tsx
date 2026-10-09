import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { AppView } from '../../app/navigation'
import { getAppViewLabel } from '../../app/displayText'
import { V3Icon, type V3IconName } from '../components/V3Primitives'
import { V3BrandLockup } from '../brand/V3BrandLockup'

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
  return <V3Icon name={name} size={20} className="v3-nav-icon" />
}

function isActive(view: AppView, currentView: AppView): boolean {
  if (view === currentView) return true
  return view === 'fiscal_closing' && (currentView === 'annual_closing' || currentView === 'quarterly_closing')
}

function V3TopBar({ currentView, onBack, backTargetView }: Pick<V3ShellChromeProps, 'currentView' | 'onBack' | 'backTargetView'>) {
  const title = primaryItems.find((item) => item.view === currentView)?.label
    ?? secondaryItems.find((item) => item.view === currentView)?.label
    ?? getAppViewLabel(currentView)

  return (
    <header className="v3-top-bar">
      <div className="v3-top-bar__leading">
        {currentView !== 'dashboard' ? (
          <button type="button" className="v3-top-bar__back" onClick={onBack} aria-label={backTargetView ? 'Volver' : 'Ir al inicio'}>
            <V3Icon name="back" size={18} />
          </button>
        ) : null}
        <V3BrandLockup />
      </div>
      <div className="v3-top-bar__context" role="status" aria-label="Pantalla actual">
        <span className="v3-top-bar__screen-label">{title}</span>
      </div>
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
    {primaryItems.map((item) => <button key={item.view} type="button" className={isActive(item.view, currentView) ? 'is-active' : ''} onClick={() => onChangeView(item.view)} aria-current={isActive(item.view, currentView) ? 'page' : undefined}><V3NavIcon name={item.icon} /><small>{item.label}</small></button>)}
    <button type="button" className={isMoreOpen || isSecondaryContext ? 'is-active' : ''} onClick={onOpenMore} aria-expanded={isMoreOpen} aria-controls="v3-more-sheet"><V3NavIcon name="more" /><small>Más</small></button>
  </nav>
}

export function V3ShellChrome(props: V3ShellChromeProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const moreTriggerRef = useRef<HTMLElement | null>(null)
  const shouldRestoreMoreFocusRef = useRef(false)

  useEffect(() => {
    if (!isMoreOpen && shouldRestoreMoreFocusRef.current) {
      shouldRestoreMoreFocusRef.current = false
      moreTriggerRef.current?.focus()
    }
  }, [isMoreOpen])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [props.currentView])

  function openMore() {
    moreTriggerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    setIsMoreOpen(true)
  }

  function closeMore() {
    shouldRestoreMoreFocusRef.current = true
    setIsMoreOpen(false)
  }

  return (
    <>
      <V3TopBar currentView={props.currentView} onBack={props.onBack} backTargetView={props.backTargetView} />
      {props.children}
      <V3BottomNav currentView={props.currentView} onChangeView={props.onChangeView} onOpenMore={openMore} isMoreOpen={isMoreOpen} />
      <V3NavigationRail currentView={props.currentView} onChangeView={props.onChangeView} onOpenMore={openMore} isMoreOpen={isMoreOpen} />
      {isMoreOpen ? <V3MoreSheet currentView={props.currentView} onChangeView={props.onChangeView} accountLabel={props.accountLabel} isSigningOut={props.isSigningOut} onSignOut={props.onSignOut} onClose={closeMore} /> : null}
    </>
  )
}
