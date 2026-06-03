import { formatCurrency, formatDateEs } from '../../app/displayFormat'
import { formatRecurringPlanLabel } from '../../app/relationshipLabels'
import type { ClientWorkspaceTab } from '../clients/useClientWorkspaceNavigation'
import type { RecurringInvoicePlanListItem } from '../recurringInvoices/types'

interface ClientBalanceLeader {
  clientId: string
  clientLabel: string
  pendingAmount: number
  pendingInvoices: number
}

interface DashboardOperationalFocusProps {
  clientBalanceLeaders: ClientBalanceLeader[]
  dueRecurringPlans: RecurringInvoicePlanListItem[]
  onOpenClientWorkspace: (clientId: string, tab?: ClientWorkspaceTab) => void
}

export function DashboardOperationalFocus({
  clientBalanceLeaders,
  dueRecurringPlans,
  onOpenClientWorkspace,
}: DashboardOperationalFocusProps) {
  return (
    <section className="cc-dashboard-block cc-dashboard-block--secondary">
      <div className="cc-dashboard-block__header cc-dashboard-block__header--split">
        <div>
          <h2>Focos operativos</h2>
          <p>Clientes con saldo abierto y automatizaciones listas para emitir sin perder contexto.</p>
        </div>
      </div>

      <div className="cc-dashboard-agenda">
        <article className="cc-agenda-card">
          <div className="cc-agenda-card__header">
            <div>
              <h3>Clientes con saldo pendiente</h3>
              <p>Prioriza la cartera que requiere seguimiento de cobro.</p>
            </div>
          </div>

          {clientBalanceLeaders.length === 0 ? (
            <div className="empty-state">
              <strong>Sin saldo abierto</strong>
              <p>No hay clientes con facturas pendientes relevantes.</p>
            </div>
          ) : (
            <div className="cc-agenda-list">
              {clientBalanceLeaders.map((entry) => (
                <button
                  key={entry.clientId}
                  type="button"
                  className="cc-agenda-item"
                  onClick={() => onOpenClientWorkspace(entry.clientId, 'payments')}
                >
                  <div className="cc-agenda-item__top">
                    <div className="cc-agenda-item__title-group">
                      <strong>{entry.clientLabel}</strong>
                      <span className="cc-agenda-item__code">{entry.pendingInvoices} factura(s) abiertas</span>
                    </div>
                    <span className="lead-badge">{formatCurrency(entry.pendingAmount)}</span>
                  </div>

                  <p>Seguimiento de cobro pendiente</p>

                  <div className="cc-agenda-item__meta">
                    <span>Abrir cobros del cliente</span>
                    <span>Workspace cliente</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </article>

        <article className="cc-agenda-card">
          <div className="cc-agenda-card__header">
            <div>
              <h3>Recurrentes listas</h3>
              <p>Planes activos cuya proxima emision ya se puede procesar.</p>
            </div>
          </div>

          {dueRecurringPlans.length === 0 ? (
            <div className="empty-state">
              <strong>Sin planes listos</strong>
              <p>No hay automatizaciones recurrentes activas para emitir hoy.</p>
            </div>
          ) : (
            <div className="cc-agenda-list">
              {dueRecurringPlans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  className="cc-agenda-item"
                  onClick={() => onOpenClientWorkspace(plan.client_id, 'invoices')}
                >
                  <div className="cc-agenda-item__top">
                    <div className="cc-agenda-item__title-group">
                      <strong>{formatRecurringPlanLabel(plan)}</strong>
                      <span className="cc-agenda-item__code">{plan.frequency}</span>
                    </div>
                    <span className="lead-badge">Lista</span>
                  </div>

                  <p>{plan.property_name ?? plan.client_name ?? 'Plan recurrente sin contexto ampliado'}</p>

                  <div className="cc-agenda-item__meta">
                    <span>Proxima emision {formatDateEs(plan.next_issue_date)}</span>
                    <span>Abrir cliente</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  )
}
