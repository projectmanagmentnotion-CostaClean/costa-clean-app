import type { AppView } from '../../app/navigation'
import type { DashboardQuickActionItem } from './types'

interface DashboardQuickActionsProps {
  onOpenView: (view: AppView) => void
}

const actions: DashboardQuickActionItem[] = [
  {
    title: 'Ver leads',
    description: 'Entrar al embudo comercial y revisar solicitudes nuevas.',
    view: 'leads',
    emphasis: 'primary',
  },
  {
    title: 'Abrir clientes',
    description: 'Consultar la base activa y sus datos principales.',
    view: 'clients',
  },
  {
    title: 'Gestionar presupuestos',
    description: 'Controlar propuestas, importes y estados comerciales.',
    view: 'quotes',
    emphasis: 'primary',
  },
  {
    title: 'Revisar servicios',
    description: 'Ir directo al módulo operativo de trabajos programados.',
    view: 'jobs',
  },
  {
    title: 'Ir a facturas',
    description: 'Emitidas, pendientes y documentación fiscal.',
    view: 'invoices',
    emphasis: 'primary',
  },
  {
    title: 'Ir a pagos',
    description: 'Control de cobros registrados y pendientes.',
    view: 'payments',
  },
]

export function DashboardQuickActions({
  onOpenView,
}: DashboardQuickActionsProps) {
  return (
    <section className="cc-dashboard-block">
      <div className="cc-dashboard-block__header">
        <div>
          <h2>Acciones rápidas</h2>
          <p>Atajos directos para moverte como una app real.</p>
        </div>
      </div>

      <div className="cc-quick-actions">
        {actions.map((action) => (
          <button
            key={action.title}
            type="button"
            className={
              action.emphasis === 'primary'
                ? 'cc-quick-action cc-quick-action--primary'
                : 'cc-quick-action'
            }
            onClick={() => onOpenView(action.view)}
          >
            <span className="cc-quick-action__title">{action.title}</span>
            <span className="cc-quick-action__text">{action.description}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
