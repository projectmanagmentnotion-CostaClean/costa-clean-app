import { useState, type ReactElement } from 'react'
import type { AppView } from '../../app/navigation'

interface DashboardQuickActionsProps {
  onOpenView: (view: AppView) => void
}

function ExpenseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        d="M7 5.5h10M8 4h8v3H8zM6.5 8.5h11A1.5 1.5 0 0 1 19 10v8.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5V10a1.5 1.5 0 0 1 1.5-1.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M9 12.5h6M9 16h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

function QuoteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        d="M7 4.5h8l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 19V6A1.5 1.5 0 0 1 7.5 4.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M15 4.5v4h4M9 12h6M9 15.5h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

function InvoiceIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        d="M7 4.5h8l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 19V6A1.5 1.5 0 0 1 7.5 4.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M15 4.5v4h4M9 12h6M9 15.5h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ClientIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <circle cx="9" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="17" cy="9.5" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M4.5 18a4.5 4.5 0 0 1 9 0M13.5 18a3.7 3.7 0 0 1 6 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PaymentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <rect x="4" y="6" width="16" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M4 10h16M8 14.5h3.5M15.5 14.5h.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ClosingIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        d="M6 5.5h12A1.5 1.5 0 0 1 19.5 7v10A1.5 1.5 0 0 1 18 18.5H6A1.5 1.5 0 0 1 4.5 17V7A1.5 1.5 0 0 1 6 5.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M8 10.5h8M8 14h5M8 5.5v-2M16 5.5v-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

function AlertsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        d="M12 4.5a4.5 4.5 0 0 1 4.5 4.5v2.3c0 .9.28 1.78.8 2.51l1.12 1.56A1 1 0 0 1 17.61 17H6.39a1 1 0 0 1-.81-1.63l1.12-1.56c.52-.73.8-1.61.8-2.51V9A4.5 4.5 0 0 1 12 4.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M10 19a2 2 0 0 0 4 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

const quickActions: Array<{
  title: string
  subtitle: string
  view: AppView
  primary?: boolean
  Icon: () => ReactElement
}> = [
  {
    title: 'Nuevo gasto',
    subtitle: 'Registrar soporte o ticket',
    view: 'expenses',
    primary: true,
    Icon: ExpenseIcon,
  },
  {
    title: 'Nuevo presupuesto',
    subtitle: 'Abrir propuesta comercial',
    view: 'quotes',
    Icon: QuoteIcon,
  },
  {
    title: 'Nueva factura',
    subtitle: 'Emitir cobro vinculado',
    view: 'invoices',
    Icon: InvoiceIcon,
  },
  {
    title: 'Nuevo cliente',
    subtitle: 'Alta rapida de cartera',
    view: 'clients',
    Icon: ClientIcon,
  },
  {
    title: 'Cierre fiscal',
    subtitle: 'Revisar y exportar por periodo',
    view: 'fiscal_closing',
    Icon: ClosingIcon,
  },
  {
    title: 'Centro de alertas',
    subtitle: 'Seguimiento operativo y fiscal',
    view: 'alerts',
    Icon: AlertsIcon,
  },
  {
    title: 'Revisar cobros',
    subtitle: 'Seguimiento de pagos',
    view: 'payments',
    Icon: PaymentIcon,
  },
]

export function DashboardQuickActions({ onOpenView }: DashboardQuickActionsProps) {
  const [isOpen, setIsOpen] = useState(() =>
    typeof window === 'undefined' ? true : !window.matchMedia('(max-width: 700px)').matches,
  )

  return (
    <details
      className="cc-dashboard-block cc-dashboard-block--utility cc-collapsible-section cc-quick-actions-panel"
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
        <summary className="cc-dashboard-block__header cc-dashboard-block__header--split cc-collapsible-section__summary cc-quick-actions-panel__summary">
          <div>
            <h2>Acciones rapidas</h2>
            <p>Accesos directos para tareas frecuentes.</p>
          </div>
        </summary>

      <div className="cc-quick-actions cc-quick-actions--dashboard">
        {quickActions.map((action) => {
          const Icon = action.Icon

          return (
            <button
              key={action.title}
              type="button"
              className={
                action.primary
                  ? 'cc-quick-action cc-quick-action--dashboard cc-quick-action--primary'
                  : 'cc-quick-action cc-quick-action--dashboard'
              }
              onClick={() => onOpenView(action.view)}
              title={action.title}
              aria-label={`${action.title}. ${action.subtitle}`}
            >
              <span className="cc-quick-action__icon" aria-hidden="true">
                <Icon />
              </span>
              <span className="cc-quick-action__content">
                <span className="cc-quick-action__title">{action.title}</span>
                <span className="cc-quick-action__text">{action.subtitle}</span>
              </span>
            </button>
          )
        })}
      </div>
    </details>
  )
}
