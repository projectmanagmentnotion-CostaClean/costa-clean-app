import type { AppView } from '../../app/navigation'

interface DashboardQuickActionsProps {
  onOpenView: (view: AppView) => void
}

const quickActions: Array<{
  title: string
  text: string
  view: AppView
  primary?: boolean
}> = [
  {
    title: 'Nuevo gasto',
    text: 'Registra compras, tickets y movimientos deducibles del negocio.',
    view: 'expenses',
    primary: true,
  },
  {
    title: 'Nuevo presupuesto',
    text: 'Crea una propuesta comercial para un cliente o inmueble.',
    view: 'quotes',
  },
  {
    title: 'Nueva factura',
    text: 'Accede a facturación y emite o revisa documentos de cobro.',
    view: 'invoices',
  },
  {
    title: 'Nuevo cliente',
    text: 'Abre la base de clientes para registrar una nueva ficha.',
    view: 'clients',
  },
  {
    title: 'Abrir gastos',
    text: 'Consulta listado, detalle, adjuntos y control documental.',
    view: 'expenses',
  },
  {
    title: 'Revisar cobros',
    text: 'Consulta pagos registrados y facturas pendientes de cobro.',
    view: 'payments',
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
        {quickActions.map((action) => (
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
            <span className="cc-quick-action__title">{action.title}</span>
            <span className="cc-quick-action__text">{action.text}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
