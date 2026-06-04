import type { OperationalAction, OperationalQuickView } from './operationalControl'

interface DashboardQuickViewsProps {
  views: OperationalQuickView[]
  onRunAction: (action: OperationalAction) => void
}

export function DashboardQuickViews({ views, onRunAction }: DashboardQuickViewsProps) {
  return (
    <section className="cc-dashboard-block cc-dashboard-block--secondary">
      <div className="cc-dashboard-block__header cc-dashboard-block__header--split">
        <div>
          <h2>Vistas rapidas</h2>
          <p>Filtros operativos listos para abrir sin reconstruir la misma busqueda cada dia.</p>
        </div>
      </div>

      <div className="cc-dashboard-view-grid">
        {views.map((view) => (
          <button
            key={view.id}
            type="button"
            className={`cc-dashboard-view cc-dashboard-view--${view.tone}`}
            onClick={() => onRunAction(view.action)}
          >
            <span className="cc-dashboard-view__label">{view.label}</span>
            <strong className="cc-dashboard-view__value">{view.value}</strong>
            <p className="cc-dashboard-view__summary">{view.summary}</p>
            <span className="cc-dashboard-view__cta">{view.action.label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
