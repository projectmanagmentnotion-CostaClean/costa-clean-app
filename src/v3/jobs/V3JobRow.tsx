import { formatCurrency, formatDateEs } from '../../app/displayFormat'
import { buildInvoicePaymentSummary } from '../../features/invoices/paymentState'
import type { InvoiceListItem } from '../../features/invoices/types'
import { getJobOperationalStatus } from '../../features/jobs/jobOperationalState'
import type { JobListItem } from '../../features/jobs/types'
import { V3EntityListItem, V3Status } from '../components/V3Primitives'

export function V3JobRow({ job, invoice, today, onOpen }: { job: JobListItem; invoice: InvoiceListItem | null; today: string; onOpen: () => void }) {
  const operational = getJobOperationalStatus(job, today)
  const payment = invoice ? buildInvoicePaymentSummary(invoice, []) : null
  const billingLabel = !invoice ? 'Sin facturar' : payment && payment.outstandingAmount > 0.009 ? 'Pendiente de cobro' : 'Cobrado'
  const billingTone = !invoice ? 'warning' : payment && payment.outstandingAmount > 0.009 ? 'warning' : 'success'
  const clientLabel = job.client_name ?? job.client_display_code ?? 'Cliente sin identificar'
  const propertyLabel = job.property_name ?? job.property_display_code ?? 'Inmueble sin identificar'
  const serviceLabel = job.billing_concept ?? job.service_type ?? 'Servicio sin concepto'

  return <V3EntityListItem className="v3-job-row v3-operational-row" onClick={onOpen} ariaLabel={`Abrir servicio${job.display_code ? ` ${job.display_code}` : ''}`}><div className="v3-job-row__main v3-operational-row__identity"><strong>{serviceLabel}</strong><span>{clientLabel} · {propertyLabel}</span><small>{formatDateEs(job.scheduled_date)}</small></div><div className="v3-job-row__side v3-operational-row__context"><div className="v3-operational-statuses"><V3Status context="Servicio" label={operational.label} tone={operational.state === 'completed' ? 'success' : operational.state === 'cancelled' ? 'danger' : 'warning'} /><V3Status context="Facturación" label={billingLabel} tone={billingTone} /></div><small className="v3-operational-row__value">{invoice ? formatCurrency(invoice.total) : 'Sin importe facturado'}</small></div></V3EntityListItem>
}
