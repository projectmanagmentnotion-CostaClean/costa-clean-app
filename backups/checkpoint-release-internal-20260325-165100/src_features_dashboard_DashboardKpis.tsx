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
    openQuotesCount: number
    scheduledJobsCount: number
    pendingInvoicesCount: number
    totalInvoiced: number
    totalCollected: number
    totalExpenses: number
    expensesThisMonthTotal: number
    expensesThisQuarterTotal: number
    expensesWithReceiptCount: number
    expensesWithoutReceiptCount: number
    deductibleExpensesCount: number
  }
}

export function DashboardKpis({ metrics }: DashboardKpisProps) {
  const globalCards = [
    {
      label: 'Leads',
      value: String(metrics.leadsCount),
      detail: 'Entradas comerciales registradas.',
      accent: 'default',
    },
    {
      label: 'Clientes',
      value: String(metrics.clientsCount),
      detail: 'Base actual de clientes activos.',
      accent: 'default',
    },
    {
      label: 'Inmuebles',
      value: String(metrics.propertiesCount),
      detail: 'Propiedades vinculadas a clientes.',
      accent: 'default',
    },
    {
      label: 'Presupuestos',
      value: String(metrics.quotesCount),
      detail: 'Propuestas creadas en el CRM.',
      accent: 'default',
    },
    {
      label: 'Servicios',
      value: String(metrics.jobsCount),
      detail: 'Servicios activos e históricos.',
      accent: 'default',
    },
    {
      label: 'Facturas',
      value: String(metrics.invoicesCount),
      detail: 'Documentos emitidos en el sistema.',
      accent: 'default',
    },
    {
      label: 'Cobros',
      value: String(metrics.paymentsCount),
      detail: 'Pagos registrados y conciliados.',
      accent: 'default',
    },
    {
      label: 'Pendientes',
      value: String(metrics.pendingInvoicesCount),
      detail: 'Facturas aún no marcadas como pagadas.',
      accent: 'warning',
    },
  ]

  const financialCards = [
    {
      label: 'Gastos totales',
      value: formatCurrency(metrics.totalExpenses),
      detail: 'Suma total registrada en el módulo de gastos.',
      accent: 'finance',
    },
    {
      label: 'Gastos del mes',
      value: formatCurrency(metrics.expensesThisMonthTotal),
      detail: 'Importe acumulado del mes actual.',
      accent: 'finance',
    },
    {
      label: 'Gastos del trimestre',
      value: formatCurrency(metrics.expensesThisQuarterTotal),
      detail: 'Seguimiento financiero del trimestre en curso.',
      accent: 'finance',
    },
    {
      label: 'Gastos registrados',
      value: String(metrics.expensesCount),
      detail: 'Número total de gastos registrados en el CRM.',
      accent: 'finance',
    },
    {
      label: 'Con documento',
      value: String(metrics.expensesWithReceiptCount),
      detail: 'Gastos con ticket o factura adjunta.',
      accent: 'success',
    },
    {
      label: 'Sin documento',
      value: String(metrics.expensesWithoutReceiptCount),
      detail: 'Gastos aún pendientes de justificante.',
      accent: 'warning',
    },
    {
      label: 'Deducibles marcados',
      value: String(metrics.deductibleExpensesCount),
      detail: 'Registros marcados como deducibles.',
      accent: 'finance',
    },
    {
      label: 'Cobrado',
      value: formatCurrency(metrics.totalCollected),
      detail: 'Importe acumulado ya cobrado.',
      accent: 'default',
    },
  ]

  return (
    <>
      <section className="cc-dashboard-block">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>KPIs globales</h2>
            <p>Visión operativa general del negocio y del estado del CRM.</p>
          </div>
        </div>

        <div className="cc-kpi-grid">
          {globalCards.map((card) => (
            <article
              key={card.label}
              className={`cc-kpi-card${card.accent ? ` cc-kpi-card--${card.accent}` : ''}`}
            >
              <span className="cc-kpi-card__label">{card.label}</span>
              <strong className="cc-kpi-card__value">{card.value}</strong>
              <p className="cc-kpi-card__detail">{card.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="cc-dashboard-block">
        <div className="cc-dashboard-block__header">
          <div>
            <h2>KPIs financieros y de gastos</h2>
            <p>Lectura rápida del estado económico y documental del negocio.</p>
          </div>
        </div>

        <div className="cc-kpi-grid">
          {financialCards.map((card) => (
            <article
              key={card.label}
              className={`cc-kpi-card${card.accent ? ` cc-kpi-card--${card.accent}` : ''}`}
            >
              <span className="cc-kpi-card__label">{card.label}</span>
              <strong className="cc-kpi-card__value">{card.value}</strong>
              <p className="cc-kpi-card__detail">{card.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
