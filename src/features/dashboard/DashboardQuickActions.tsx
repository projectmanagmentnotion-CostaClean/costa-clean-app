import type { ReactElement } from 'react'
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

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        d="M4.5 7.5A1.5 1.5 0 0 1 6 6h4l1.5 2H18A1.5 1.5 0 0 1 19.5 9.5v8A1.5 1.5 0 0 1 18 19H6a1.5 1.5 0 0 1-1.5-1.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
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

const quickActions: Array<{
  title: string
  text: string
  view: AppView
  primary?: boolean
  Icon: () => ReactElement
}> = [
  {
    title: 'Nuevo gasto',
    text: 'Registra compras, tickets y movimientos deducibles del negocio.',
    view: 'expenses',
    primary: true,
    Icon: ExpenseIcon,
  },
  {
    title: 'Nuevo presupuesto',
    text: 'Crea una propuesta comercial para un cliente o inmueble.',
    view: 'quotes',
    Icon: QuoteIcon,
  },
  {
    title: 'Nueva factura',
    text: 'Accede a facturación y emite o revisa documentos de cobro.',
    view: 'invoices',
    Icon: InvoiceIcon,
  },
  {
    title: 'Nuevo cliente',
    text: 'Abre la base de clientes para registrar una nueva ficha.',
    view: 'clients',
    Icon: ClientIcon,
  },
  {
    title: 'Abrir gastos',
    text: 'Consulta listado, detalle, adjuntos y control documental.',
    view: 'expenses',
    Icon: FolderIcon,
  },
  {
    title: 'Revisar cobros',
    text: 'Consulta pagos registrados y facturas pendientes de cobro.',
    view: 'payments',
    Icon: PaymentIcon,
  },
]

export function DashboardQuickActions({ onOpenView }: DashboardQuickActionsProps) {
  return (
    <section className="cc-dashboard-block">
      <div className="cc-dashboard-block__header">
        <div>
          <h2>Acciones rápidas</h2>
          <p>Atajos elegantes para entrar de inmediato a los flujos más usados.</p>
        </div>
      </div>

      <div className="cc-quick-actions">
        {quickActions.map((action) => {
          const Icon = action.Icon

          return (
            <button
              key={action.title}
              type="button"
              className={
                action.primary
                  ? 'cc-quick-action cc-quick-action--primary'
                  : 'cc-quick-action'
              }
              onClick={() => onOpenView(action.view)}
            >
              <span className="cc-quick-action__icon" aria-hidden="true">
                <Icon />
              </span>
              <span className="cc-quick-action__title">{action.title}</span>
              <span className="cc-quick-action__text">{action.text}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

