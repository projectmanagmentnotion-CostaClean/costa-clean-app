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
      accent: 'default',
    },
    {
      label: 'Clientes',
      value: String(metrics.clientsCount),
      accent: 'default',
    },
    {
      label: 'Inmuebles',
      value: String(metrics.propertiesCount),
      accent: 'default',
    },
    {
      label: 'Presupuestos',
      value: String(metrics.quotesCount),
      accent: 'default',
    },
    {
      label: 'Servicios',
      value: String(metrics.jobsCount),
      accent: 'default',
    },
    {
      label: 'Facturas',
      value: String(metrics.invoicesCount),
      accent: 'default',
    },
    {
      label: 'Cobros',
      value: String(metrics.paymentsCount),
      accent: 'default',
    },
    {
      label: 'Pendientes',
      value: String(metrics.pendingInvoicesCount),
      accent: 'warning',
    },
  ]

  const financialCards = [
    {
      label: 'Gastos totales',
      value: formatCurrency(metrics.totalExpenses),
      accent: 'finance',
    },
    {
      label: 'Gastos del mes',
      value: formatCurrency(metrics.expensesThisMonthTotal),
      accent: 'finance',
    },
    {
      label: 'Gastos del trimestre',
      value: formatCurrency(metrics.expensesThisQuarterTotal),
      accent: 'finance',
    },
    {
      label: 'Gastos registrados',
      value: String(metrics.expensesCount),
      accent: 'finance',
    },
    {
      label: 'Con documento',
      value: String(metrics.expensesWithReceiptCount),
      accent: 'success',
    },
    {
      label: 'Sin documento',
      value: String(metrics.expensesWithoutReceiptCount),
      accent: 'warning',
    },
    {
      label: 'Deducibles marcados',
      value: String(metrics.deductibleExpensesCount),
      accent: 'finance',
    },
    {
      label: 'Cobrado',
      value: formatCurrency(metrics.totalCollected),
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

            </article>
          ))}
        </div>
      </section>
    </>
  )
}

