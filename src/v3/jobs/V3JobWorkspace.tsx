import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
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
import { V3BottomSheet, V3ConfirmSheet, V3DetailSection, V3EntityStatus, V3Field, V3Input, V3Page, V3PageTitle, V3PrimaryAction, V3SecondaryAction, V3Select, V3StickyActionBar, V3Textarea } from '../components/V3Primitives'
import { canCreateInvoiceFromJob } from '../../features/jobs/jobInvoiceEligibility'
import { buildJobWorkReportPdfFile, buildJobWorkReportPdfFileName } from './jobWorkReport'
import { V3StepFlow } from '../stepflow/V3StepFlow'

const STATUS_OPTIONS = [['pending', 'Pendiente'], ['scheduled', 'Programado'], ['in_progress', 'En curso'], ['completed', 'Realizado'], ['cancelled', 'Cancelado']] as const
type JobEditState = { scheduled_date: string; status: string; notes: string; line: BillingLineFormState }

function toDraftLine(job: JobListItem, line: ReturnType<typeof getJobBillingLines>[number]): BillingLineFormState {
  return { local_id: line.id ?? `JOB-LINE-${job.id}`, concept: line.concept, quantity: formatQuantityInput(line.quantity), unit: line.unit, unit_price: formatMoneyInput(line.unit_price) }
}

function JobEditSheet({ edit, setEdit, busy, onSubmit, onClose }: { edit: JobEditState; setEdit: Dispatch<SetStateAction<JobEditState>>; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onClose: () => void }) {
  return <V3StepFlow title="Editar servicio" onCancel={onClose} onComplete={() => onSubmit(new Event('submit') as unknown as FormEvent<HTMLFormElement>)} busy={busy} completeLabel="Guardar cambios" steps={[{ id: 'schedule', title: 'Agenda', content: <><V3Field label="Fecha"><V3Input type="date" value={edit.scheduled_date} onChange={(event) => setEdit((current) => ({ ...current, scheduled_date: event.target.value }))} required autoFocus /></V3Field><V3Field label="Estado"><V3Select value={edit.status} onChange={(event) => setEdit((current) => ({ ...current, status: event.target.value }))}>{STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</V3Select></V3Field></> }, { id: 'billing', title: 'Precio', content: <><V3Field label="Concepto"><V3Input value={edit.line.concept} onChange={(event) => setEdit((current) => ({ ...current, line: { ...current.line, concept: event.target.value } }))} required /></V3Field><V3Field label="Cantidad"><V3Input inputMode="decimal" value={edit.line.quantity} onChange={(event) => setEdit((current) => ({ ...current, line: { ...current.line, quantity: event.target.value } }))} required /></V3Field><V3Field label="Unidad"><V3Input value={edit.line.unit} onChange={(event) => setEdit((current) => ({ ...current, line: { ...current.line, unit: event.target.value } }))} required /></V3Field><V3Field label="Precio unitario"><V3Input inputMode="decimal" value={edit.line.unit_price} onChange={(event) => setEdit((current) => ({ ...current, line: { ...current.line, unit_price: event.target.value } }))} required /></V3Field></> }, { id: 'review', title: 'Notas y revisión', content: <V3Field label="Notas"><V3Textarea value={edit.notes} onChange={(event) => setEdit((current) => ({ ...current, notes: event.target.value }))} /></V3Field> }]} />
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
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reportBusy, setReportBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [reportMessage, setReportMessage] = useState<string | null>(null)
  const [edit, setEdit] = useState<JobEditState>(() => ({ scheduled_date: job.scheduled_date, status: job.status, notes: job.notes ?? '', line: lines[0] ? toDraftLine(job, lines[0]) : createBlankBillingLine({ concept: getJobBillingDisplayConcept(job) }) }))
  const timeline = useMemo(() => buildJobTimelineItems({ job, quote, invoice, payments: relatedPayments }), [invoice, job, quote, relatedPayments])
  const invoiceEligible = canCreateInvoiceFromJob(job, props.invoices)
  const primaryActionLabel = invoiceEligible ? 'Crear factura' : invoice ? 'Ver factura' : 'Editar servicio'
  const primaryActionContext = invoiceEligible ? 'Servicio realizado sin factura relacionada. Puedes preparar una factura desde este servicio.' : invoice ? 'Ya existe una factura relacionada. Ábrela para revisar su estado y sus cobros.' : 'El servicio todavía no está listo para facturar. Revisa su fecha, estado o detalle operativo.'

  async function refresh() { await props.onRefresh(); setEditOpen(false); setMessage('Servicio actualizado.') }
  async function saveEdits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (edit.status === 'cancelled' && job.status !== 'cancelled') { setCancelConfirmOpen(true); return }
    await persistEdits()
  }
  async function persistEdits() {
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
  async function downloadReport() {
    setReportBusy(true); setReportMessage('Generando parte en PDF…')
    try { const file = await buildJobWorkReportPdfFile(job, client, property, quote, invoice, relatedPayments); await deliverPdfFile(file, buildJobWorkReportPdfFileName(job)); setReportMessage('Parte descargado.') } catch (error) { setReportMessage(error instanceof Error ? error.message : 'No se pudo generar el parte.') } finally { setReportBusy(false) }
  }
  async function shareReport() {
    setReportBusy(true); setReportMessage('Preparando parte para compartir…')
    try { const file = await buildJobWorkReportPdfFile(job, client, property, quote, invoice, relatedPayments); const result = await shareDocument({ blob: file, filename: file.name, title: `Parte de trabajo ${job.display_code ?? 'servicio'}` }); setReportMessage(result === 'shared' ? 'Parte listo para compartir.' : result === 'downloaded' ? 'Parte descargado como alternativa.' : 'Compartir cancelado.') } catch (error) { setReportMessage(error instanceof Error ? error.message : 'No se pudo compartir el parte.') } finally { setReportBusy(false) }
  }
  function handlePrimaryAction() {
    if (invoiceEligible) { props.onCreateInvoice(); return }
    if (invoice) { props.onOpenInvoice(invoice.id); return }
    setEditOpen(true)
  }

  return <V3Page className="v3-job-workspace">
    <V3PageTitle eyebrow="Servicios" title={job.display_code ?? 'Servicio'} description={getJobBillingDisplayConcept(job)} action={<V3SecondaryAction onClick={props.onBack}>Volver</V3SecondaryAction>} />
    <div className="v3-job-workspace__status"><V3EntityStatus context="Servicio" label={operational.label} tone={operational.state === 'completed' ? 'success' : operational.state === 'cancelled' ? 'danger' : operational.state === 'review' ? 'warning' : 'neutral'} /><span>{formatDateEs(job.scheduled_date)}</span></div>
    {message ? <p className="v3-inline-message" role="status">{message}</p> : null}
    <V3StickyActionBar><V3PrimaryAction disabled={busy} onClick={handlePrimaryAction}>{primaryActionLabel}</V3PrimaryAction><V3SecondaryAction disabled={busy} onClick={() => setEditOpen(true)}>Editar</V3SecondaryAction><V3SecondaryAction disabled={busy} onClick={() => setMoreOpen(true)}>Más</V3SecondaryAction></V3StickyActionBar>
    <V3DetailSection title="Próximo paso"><p className="v3-section-copy">{primaryActionContext}</p></V3DetailSection>
    <V3DetailSection title="Situación"><div className="v3-summary"><div><span>Estado</span><strong>{operational.label}</strong></div><div><span>Facturación</span><strong>{invoice ? paymentSummary ? getInvoiceFinancialStatusLabel(paymentSummary.financialStatus) : 'Facturada' : 'Sin facturar'}</strong></div><div><span>Importe</span><strong>{invoice ? formatCurrency(invoice.total) : 'Pendiente de factura'}</strong></div></div></V3DetailSection>
    <V3DetailSection title="Operativa"><p>{getServiceTypeLabel(job.service_type)} · {getJobBillingDisplayConcept(job)}</p>{job.notes?.trim() ? <p>{job.notes.trim()}</p> : <p>Sin notas operativas.</p>}</V3DetailSection>
    <V3DetailSection title="Relaciones"><div className="v3-related-links"><button type="button" onClick={() => props.onOpenClient(job.client_id)}>{client ? formatClientLabel(client) : job.client_name ?? 'Cliente'}</button><button type="button" onClick={() => props.onOpenProperty(job.property_id)}>{property ? formatPropertyLabel(property) : job.property_name ?? 'Inmueble'}</button>{quote ? <button type="button" onClick={() => props.onOpenQuote(quote.id)}>{formatQuoteLabel(quote)}</button> : <span>Sin presupuesto relacionado</span>}{invoice ? <button type="button" onClick={() => props.onOpenInvoice(invoice.id)}>{formatInvoiceLabel(invoice)}</button> : <span>Sin factura relacionada</span>}</div></V3DetailSection>
    <V3DetailSection title="Parte de trabajo"><p className="v3-section-copy">Resumen operativo del servicio. No certifica ejecución, firma ni geolocalización.</p><div className="v3-document-actions"><V3PrimaryAction disabled={reportBusy} onClick={() => void downloadReport()}>{reportBusy ? 'Generando parte…' : 'Descargar PDF'}</V3PrimaryAction><V3SecondaryAction disabled={reportBusy} onClick={() => void shareReport()}>Compartir parte</V3SecondaryAction></div>{reportMessage ? <p className="v3-inline-message" role="status">{reportMessage}</p> : null}</V3DetailSection>
    <V3DetailSection title="Actividad"><div className="v3-timeline">{timeline.map((item) => <div key={item.id}><strong>{item.title}</strong><span>{formatDateEs(item.date)} · {item.detail}</span></div>)}</div></V3DetailSection>
    {editOpen ? <JobEditSheet edit={edit} setEdit={setEdit} busy={busy} onSubmit={(event) => void saveEdits(event)} onClose={() => setEditOpen(false)} /> : null}
    {moreOpen ? <V3BottomSheet title="Más acciones" onClose={() => setMoreOpen(false)}><div className="v3-form"><V3SecondaryAction disabled={busy} onClick={() => void archiveJob()}>Archivar servicio</V3SecondaryAction></div></V3BottomSheet> : null}
    {cancelConfirmOpen ? <V3ConfirmSheet title="Cancelar servicio" description="El servicio pasará a estado cancelado y dejará de estar operativo." confirmLabel="Confirmar cancelación" onCancel={() => setCancelConfirmOpen(false)} onConfirm={() => { setCancelConfirmOpen(false); void persistEdits() }} /> : null}
  </V3Page>
}
