import { formatCurrency, formatDateEs, getDisplayStatusLabel } from '../../app/displayFormat'
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
  return <V3EntityListItem onClick={onOpen} ariaLabel={`Abrir servicio ${job.display_code ?? job.id}`}><div className="v3-job-row__main"><strong>{job.billing_concept ?? job.service_type}</strong><span>{job.client_name ?? job.client_display_code ?? job.client_id} · {job.property_name ?? job.property_display_code ?? job.property_id}</span><small>{formatDateEs(job.scheduled_date)} · {getDisplayStatusLabel(job.status)}</small></div><div className="v3-job-row__side"><V3Status label={operational.label} tone={operational.state === 'completed' ? 'success' : operational.state === 'cancelled' ? 'danger' : 'warning'} /><V3Status label={billingLabel} tone={billingTone} /><small>{invoice ? formatCurrency(invoice.total) : '—'}</small></div></V3EntityListItem>
}
