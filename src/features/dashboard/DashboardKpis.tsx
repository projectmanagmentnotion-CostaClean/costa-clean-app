import type { DashboardKpiActionId } from './kpiActions'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

interface DashboardKpisProps {
  metrics: {
    leadsCount: number
    clientsCount: number
    propertiesCount: number
    quotesCount: number
    jobsCount: number
    invoicesCount: number
    paymentsCount: number
    expensesCount: number
    pendingInvoicesCount: number
    completedJobsWithoutInvoiceCount: number
    acceptedQuotesWithoutJobCount: number
    expensesThisMonthTotal: number
    expensesThisQuarterTotal: number
    expensesWithReceiptCount: number
    expensesWithoutReceiptCount: number
    deductibleExpensesCount: number
    estimatedDeductibleVat: number
    estimatedDeductibleBase: number
    fiscalReviewExpensesCount: number
    fiscalRiskExpensesCount: number
    expensesMissingValidVatInvoiceCount: number
    expensesZeroEstimatedVatCount: number
    totalExpenses: number
    totalCollected: number
  }
  onRunKpiAction: (actionId: DashboardKpiActionId) => void
}

export function DashboardKpis({ metrics, onRunKpiAction }: DashboardKpisProps) {
  const operationalCards: Array<{
    label: string
    value: string
    detail: string
    actionId?: DashboardKpiActionId
    tone?: 'warning' | 'success' | 'finance'
  }> = [
    {
      label: 'Trabajos completados sin factura',
      value: String(metrics.completedJobsWithoutInvoiceCount),
      detail: 'Servicios terminados que aun no han pasado a facturacion.',
      actionId: 'completed_jobs_without_invoice',
      tone: 'warning',
    },
    {
      label: 'Presupuestos aceptados sin trabajo',
      value: String(metrics.acceptedQuotesWithoutJobCount),
      detail: 'Aceptados comercialmente pendientes de planificacion.',
      actionId: 'accepted_quotes_without_job',
      tone: 'warning',
    },
    {
      label: 'Facturas pendientes',
      value: String(metrics.pendingInvoicesCount),
      detail: 'Control rapido del pendiente de cobro abierto.',
      actionId: 'pending_invoices',
      tone: 'warning',
    },
    {
      label: 'Requiere revision fiscal',
      value: String(metrics.fiscalReviewExpensesCount),
      detail: 'Estimaciones o estados pendientes de revisar antes del cierre.',
      actionId: 'expenses_fiscal_requires_review',
      tone: 'warning',
    },
    {
      label: 'Riesgo fiscal gastos',
      value: String(metrics.fiscalRiskExpensesCount),
      detail: 'Gastos con riesgo medio/alto segun campos manuales o IA.',
      actionId: 'expenses_fiscal_medium_high_risk',
      tone: 'warning',
    },
  ]

  const portfolioCards: Array<{
    label: string
    value: string
    actionId?: DashboardKpiActionId
    tone?: 'finance' | 'success'
  }> = [
    { label: 'Leads', value: String(metrics.leadsCount) },
    { label: 'Clientes', value: String(metrics.clientsCount) },
    { label: 'Inmuebles', value: String(metrics.propertiesCount) },
    { label: 'Presupuestos', value: String(metrics.quotesCount) },
    { label: 'Servicios', value: String(metrics.jobsCount) },
    { label: 'Facturas', value: String(metrics.invoicesCount) },
    { label: 'Cobros', value: String(metrics.paymentsCount) },
    { label: 'Gastos', value: String(metrics.expensesCount) },
    { label: 'Gasto del trimestre', value: formatCurrency(metrics.expensesThisQuarterTotal), tone: 'finance' as const },
    { label: 'Gastos totales', value: formatCurrency(metrics.totalExpenses), tone: 'finance' as const },
    { label: 'IVA deducible estimado', value: formatCurrency(metrics.estimatedDeductibleVat), tone: 'finance' as const },
    { label: 'Base deducible estimada', value: formatCurrency(metrics.estimatedDeductibleBase), tone: 'finance' as const },
    { label: 'Con documento', value: String(metrics.expensesWithReceiptCount), tone: 'success' as const },
    { label: 'Sin factura valida IVA', value: String(metrics.expensesMissingValidVatInvoiceCount), actionId: 'expenses_missing_valid_vat_invoice' },
    { label: 'IVA estimado 0', value: String(metrics.expensesZeroEstimatedVatCount), actionId: 'expenses_vat_zero_estimate' },
    { label: 'Deducibles marcados', value: String(metrics.deductibleExpensesCount), tone: 'success' as const },
    { label: 'Cobrado acumulado', value: formatCurrency(metrics.totalCollected), tone: 'finance' as const },
    { label: 'Gastos del mes', value: formatCurrency(metrics.expensesThisMonthTotal), actionId: 'expenses_this_month', tone: 'finance' as const },
  ]

  return (
    <section className="cc-dashboard-block cc-dashboard-block--secondary">
      <div className="cc-dashboard-block__header cc-dashboard-block__header--split">
        <div>
          <h2>Indicadores operativos</h2>
          <p>Seguimiento secundario para conversion, cobertura y control documental.</p>
        </div>
      </div>

      <div className="cc-dashboard-secondary-grid">
        <div className="cc-dashboard-subsection">
          <div className="cc-dashboard-subsection__header">
            <h3>Atencion operativa</h3>
            <p>Bloque enfocado en incidencias accionables del dia a dia.</p>
          </div>

          <div className="cc-kpi-grid cc-kpi-grid--compact">
            {operationalCards.map((card) => (
              <button
                key={card.label}
                type="button"
                className={`cc-kpi-card cc-kpi-card--compact cc-kpi-card--actionable${card.tone ? ` cc-kpi-card--${card.tone}` : ''}`}
                onClick={() => onRunKpiAction(card.actionId!)}
              >
                <span className="cc-kpi-card__label">{card.label}</span>
                <strong className="cc-kpi-card__value">{card.value}</strong>
                <p className="cc-kpi-card__detail">{card.detail}</p>
                <span className="cc-kpi-card__hint">Abrir lista</span>
              </button>
            ))}
          </div>
        </div>

        <div className="cc-dashboard-subsection">
          <div className="cc-dashboard-subsection__header">
            <h3>Base operativa y cobertura</h3>
            <p>Volumen de cartera, actividad registrada y control de soporte.</p>
          </div>

          <div className="cc-kpi-grid cc-kpi-grid--dense">
            {portfolioCards.map((card) => (
              card.actionId ? (
                <button
                  key={card.label}
                  type="button"
                  className={`cc-kpi-card cc-kpi-card--micro cc-kpi-card--actionable${card.tone ? ` cc-kpi-card--${card.tone}` : ''}`}
                  onClick={() => onRunKpiAction(card.actionId!)}
                >
                  <span className="cc-kpi-card__label">{card.label}</span>
                  <strong className="cc-kpi-card__value">{card.value}</strong>
                </button>
              ) : (
                <article
                  key={card.label}
                  className={`cc-kpi-card cc-kpi-card--micro${card.tone ? ` cc-kpi-card--${card.tone}` : ''}`}
                >
                  <span className="cc-kpi-card__label">{card.label}</span>
                  <strong className="cc-kpi-card__value">{card.value}</strong>
                </article>
              )
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
