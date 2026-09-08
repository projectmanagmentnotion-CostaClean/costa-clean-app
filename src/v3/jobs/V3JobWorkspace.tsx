import { useMemo, useState, type FormEvent } from 'react'
import { formatCurrency, formatDateEs, getServiceTypeLabel } from '../../app/displayFormat'
import { formatClientLabel, formatPropertyLabel, formatQuoteLabel, formatInvoiceLabel } from '../../app/relationshipLabels'
import { fetchAuthenticatedSupabaseWrite, readSingleAuthenticatedWriteRow } from '../../lib/authenticatedSupabaseWrite'
import { operationalWriteRpcPaths } from '../../lib/operationalWriteRpc'
import { patchLifecycleEntity } from '../../shared/lifecycle/lifecycleApi'
import { buildInvoicePaymentSummary, getInvoiceFinancialStatusLabel } from '../../features/invoices/paymentState'
import { buildJobTimelineItems } from '../../features/relationships/timeline'
import { getJobBillingLines, getJobBillingDisplayConcept } from '../../features/jobs/jobBilling'
import { buildJobLinePayloads, buildJobBillingSummary, saveJobWithLines } from '../../features/jobs/jobWriteApi'
import { buildBillingLinePayloads, createBlankBillingLine, formatMoneyInput, formatQuantityInput, type BillingLineFormState } from '../../features/shared/billingLineDrafts'
import { getJobOperationalStatus } from '../../features/jobs/jobOperationalState'
import type { ClientListItem } from '../../features/clients/types'
import type { InvoiceListItem } from '../../features/invoices/types'
import type { JobListItem } from '../../features/jobs/types'
import type { PaymentListItem } from '../../features/payments/types'
import type { PropertyListItem } from '../../features/properties/types'
import type { QuoteListItem } from '../../features/quotes/types'
import { shareDocument } from '../documents/shareDocument'
import { deliverPdfFile } from '../../features/documents/documentFileDelivery'
import { V3BottomSheet, V3DetailSection, V3EntityStatus, V3Field, V3Input, V3Page, V3PageTitle, V3PrimaryAction, V3SecondaryAction, V3Select, V3StickyActionBar, V3Textarea } from '../components/V3Primitives'
import { canCreateInvoiceFromJob } from '../../features/jobs/jobInvoiceEligibility'
import { buildJobWorkReportPdfFile, buildJobWorkReportPdfFileName } from './jobWorkReport'

const STATUS_OPTIONS = [['pending', 'Pendiente'], ['scheduled', 'Programado'], ['in_progress', 'En curso'], ['completed', 'Realizado'], ['cancelled', 'Cancelado']] as const

function toDraftLine(job: JobListItem, line: ReturnType<typeof getJobBillingLines>[number]): BillingLineFormState {
  return { local_id: line.id ?? `JOB-LINE-${job.id}`, concept: line.concept, quantity: formatQuantityInput(line.quantity), unit: line.unit, unit_price: formatMoneyInput(line.unit_price) }
}

interface V3JobWorkspaceProps { job: JobListItem; clients: ClientListItem[]; properties: PropertyListItem[]; quotes: QuoteListItem[]; invoices: InvoiceListItem[]; payments: PaymentListItem[]; onBack: () => void; onRefresh: () => Promise<void>; onOpenClient: (id: string) => void; onOpenProperty: (id: string) => void; onOpenQuote: (id: string) => void; onOpenInvoice: (id: string) => void; onCreateInvoice: () => void }

export function V3JobWorkspace(props: V3JobWorkspaceProps) {
  const { job } = props
  const today = new Date().toISOString().slice(0, 10)
  const client = props.clients.find((item) => item.id === job.client_id) ?? null
  const property = props.properties.find((item) => item.id === job.property_id) ?? null
  const quote = props.quotes.find((item) => item.id === job.quote_id) ?? null
  const invoice = props.invoices.find((item) => item.job_id === job.id || item.id === job.invoice_id) ?? null
  const relatedPayments = props.payments.filter((payment) => payment.invoice_id === invoice?.id)
  const paymentSummary = invoice ? buildInvoicePaymentSummary(invoice, relatedPayments) : null
  const operational = getJobOperationalStatus(job, today)
  const lines = getJobBillingLines(job)
  const [editOpen, setEditOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [edit, setEdit] = useState(() => ({ scheduled_date: job.scheduled_date, status: job.status, notes: job.notes ?? '', line: lines[0] ? toDraftLine(job, lines[0]) : createBlankBillingLine({ concept: getJobBillingDisplayConcept(job) }) }))
  const timeline = useMemo(() => buildJobTimelineItems({ job, quote, invoice, payments: relatedPayments }), [invoice, job, quote, relatedPayments])

  async function refresh() { await props.onRefresh(); setEditOpen(false); setMessage('Servicio actualizado.') }

  async function saveEdits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (edit.status === 'cancelled' && job.status !== 'cancelled' && !window.confirm('¿Cancelar este servicio?')) return
    setBusy(true); setMessage(null)
    try {
      const linePayloads = buildBillingLinePayloads([edit.line], (value) => value.trim())
      if (!linePayloads) throw new Error('Completa concepto, cantidad y precio unitario.')
      const billingSummary = buildJobBillingSummary(linePayloads, getServiceTypeLabel(job.service_type))
      await saveJobWithLines({ id: job.id, client_id: job.client_id, property_id: job.property_id, quote_id: job.quote_id ?? null, scheduled_date: edit.scheduled_date, status: job.status, service_type: job.service_type, billing_concept: billingSummary.billing_concept, billing_quantity: billingSummary.billing_quantity, billing_unit: billingSummary.billing_unit, billing_unit_price: billingSummary.billing_unit_price, notes: edit.notes.trim() || null }, buildJobLinePayloads(linePayloads, job.id))
      if (edit.status !== job.status) {
        const response = await fetchAuthenticatedSupabaseWrite(operationalWriteRpcPaths.updateJobStatus, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_job_id: job.id, p_status: edit.status }) })
        await readSingleAuthenticatedWriteRow(response, 'No se pudo actualizar el estado del servicio.')
      }
      await refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo guardar el servicio.') } finally { setBusy(false) }
  }

  async function archiveJob() {
    setBusy(true); setMessage(null)
    try { await patchLifecycleEntity('jobs', job.id, { archived_at: new Date().toISOString() }); await refresh() } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo archivar el servicio.') } finally { setBusy(false); setMoreOpen(false) }
  }

  async function downloadReport() { setBusy(true); setMessage(null); try { const file = await buildJobWorkReportPdfFile(job, client, property, quote, invoice, relatedPayments); await deliverPdfFile(file, buildJobWorkReportPdfFileName(job)); setMessage('Parte descargado.') } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo generar el parte.') } finally { setBusy(false) } }
  async function shareReport() { setBusy(true); setMessage(null); try { const file = await buildJobWorkReportPdfFile(job, client, property, quote, invoice, relatedPayments); const result = await shareDocument({ blob: file, filename: file.name, title: `Parte de trabajo ${job.display_code ?? job.id}` }); setMessage(result === 'shared' ? 'Parte listo para compartir.' : result === 'downloaded' ? 'Parte descargado como alternativa.' : 'Compartir cancelado.') } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo compartir el parte.') } finally { setBusy(false) } }

  function handlePrimaryAction() {
    if (canCreateInvoiceFromJob(job, props.invoices)) { props.onCreateInvoice(); return }
    if (invoice) { props.onOpenInvoice(invoice.id); return }
    setEditOpen(true)
  }

  return <V3Page className="v3-job-workspace"><V3PageTitle eyebrow="Servicios" title={job.display_code ?? 'Servicio'} description={getJobBillingDisplayConcept(job)} action={<V3SecondaryAction onClick={props.onBack}>Volver</V3SecondaryAction>} /><div className="v3-job-workspace__status"><V3EntityStatus label={operational.label} tone={operational.state === 'completed' ? 'success' : operational.state === 'cancelled' ? 'danger' : operational.state === 'review' ? 'warning' : 'neutral'} /><span>{formatDateEs(job.scheduled_date)}</span></div>{message ? <p className="v3-inline-message" role="status">{message}</p> : null}<V3StickyActionBar><V3PrimaryAction disabled={busy} onClick={handlePrimaryAction}>{canCreateInvoiceFromJob(job, props.invoices) ? 'Crear factura' : invoice ? 'Ver factura' : 'Editar servicio'}</V3PrimaryAction><V3SecondaryAction disabled={busy} onClick={() => setEditOpen(true)}>Editar</V3SecondaryAction><V3SecondaryAction disabled={busy} onClick={() => setMoreOpen(true)}>Más</V3SecondaryAction></V3StickyActionBar><V3DetailSection title="Situación"><div className="v3-summary"><div><span>Estado</span><strong>{operational.label}</strong></div><div><span>Facturación</span><strong>{invoice ? paymentSummary ? getInvoiceFinancialStatusLabel(paymentSummary.financialStatus) : 'Facturada' : 'Sin facturar'}</strong></div><div><span>Importe</span><strong>{invoice ? formatCurrency(invoice.total) : 'Pendiente de factura'}</strong></div></div></V3DetailSection><V3DetailSection title="Operativa"><p>{getServiceTypeLabel(job.service_type)} · {getJobBillingDisplayConcept(job)}</p>{job.notes?.trim() ? <p>{job.notes.trim()}</p> : <p>Sin notas operativas.</p>}</V3DetailSection><V3DetailSection title="Relaciones"><div className="v3-related-links"><button type="button" onClick={() => props.onOpenClient(job.client_id)}>{client ? formatClientLabel(client) : job.client_name ?? 'Cliente'}</button><button type="button" onClick={() => props.onOpenProperty(job.property_id)}>{property ? formatPropertyLabel(property) : job.property_name ?? 'Inmueble'}</button>{quote ? <button type="button" onClick={() => props.onOpenQuote(quote.id)}>{formatQuoteLabel(quote)}</button> : <span>Sin presupuesto relacionado</span>}{invoice ? <button type="button" onClick={() => props.onOpenInvoice(invoice.id)}>{formatInvoiceLabel(invoice)}</button> : <span>Sin factura relacionada</span>}</div></V3DetailSection><V3DetailSection title="Documentos"><div className="v3-document-actions"><V3SecondaryAction disabled={busy} onClick={() => void downloadReport()}>Descargar parte PDF</V3SecondaryAction><V3SecondaryAction disabled={busy} onClick={() => void shareReport()}>Compartir parte</V3SecondaryAction></div><small>Resumen operativo del servicio. No certifica ejecución, firma ni geolocalización.</small></V3DetailSection><V3DetailSection title="Actividad"><div className="v3-timeline">{timeline.map((item) => <div key={item.id}><strong>{item.title}</strong><span>{formatDateEs(item.date)} · {item.detail}</span></div>)}</div></V3DetailSection>{editOpen ? <V3BottomSheet title="Editar servicio" onClose={() => setEditOpen(false)}><form className="v3-form" onSubmit={(event) => void saveEdits(event)}><V3Field label="Fecha"><V3Input type="date" value={edit.scheduled_date} onChange={(event) => setEdit((current) => ({ ...current, scheduled_date: event.target.value }))} required /></V3Field><V3Field label="Estado"><V3Select value={edit.status} onChange={(event) => setEdit((current) => ({ ...current, status: event.target.value }))}>{STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</V3Select></V3Field><V3Field label="Concepto"><V3Input value={edit.line.concept} onChange={(event) => setEdit((current) => ({ ...current, line: { ...current.line, concept: event.target.value } }))} required /></V3Field><V3Field label="Cantidad"><V3Input inputMode="decimal" value={edit.line.quantity} onChange={(event) => setEdit((current) => ({ ...current, line: { ...current.line, quantity: event.target.value } }))} required /></V3Field><V3Field label="Unidad"><V3Input value={edit.line.unit} onChange={(event) => setEdit((current) => ({ ...current, line: { ...current.line, unit: event.target.value } }))} required /></V3Field><V3Field label="Precio unitario"><V3Input inputMode="decimal" value={edit.line.unit_price} onChange={(event) => setEdit((current) => ({ ...current, line: { ...current.line, unit_price: event.target.value } }))} required /></V3Field><V3Field label="Notas"><V3Textarea value={edit.notes} onChange={(event) => setEdit((current) => ({ ...current, notes: event.target.value }))} /></V3Field><V3PrimaryAction type="submit" disabled={busy}>Guardar cambios</V3PrimaryAction></form></V3BottomSheet> : null}{moreOpen ? <V3BottomSheet title="Más acciones" onClose={() => setMoreOpen(false)}><div className="v3-form"><V3SecondaryAction disabled={busy} onClick={() => void archiveJob()}>Archivar servicio</V3SecondaryAction></div></V3BottomSheet> : null}</V3Page>
}
