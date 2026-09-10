import { useMemo, useState } from 'react'
import { businessRules } from '../../app/businessRules'
import type { ClientListItem } from '../../features/clients/types'
import { findInvoiceDuplicateGroups } from '../../features/duplicates/duplicateEngine'
import { saveInvoiceWithLines } from '../../features/financial/financialWriteApi'
import type { JobListItem } from '../../features/jobs/types'
import { buildBillingLinePayloads, calculateBillingSubtotal, createBlankBillingLine, createLocalId, formatMoneyInput, formatQuantityInput, roundMoney, type BillingLineFormState } from '../../features/shared/billingLineDrafts'
import type { InvoiceListItem } from '../../features/invoices/types'
import type { PropertyListItem } from '../../features/properties/types'
import type { QuoteListItem } from '../../features/quotes/types'
import { V3BottomSheet, V3Field, V3Input, V3PrimaryAction, V3SecondaryAction, V3Select, V3Textarea } from '../components/V3Primitives'

interface Props { clients: ClientListItem[]; properties: PropertyListItem[]; jobs: JobListItem[]; quotes: QuoteListItem[]; invoices: InvoiceListItem[]; onRefreshData: () => Promise<void>; onCompleted: () => Promise<void> | void; onCancel: () => void; onOpenExistingInvoice?: (id: string) => void; prefillClientId?: string; prefillJobId?: string; prefillQuoteId?: string }
function today() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` }
export function V3InvoiceCreateFlow({ clients, properties, jobs, quotes, invoices, onRefreshData, onCompleted, onCancel, onOpenExistingInvoice, prefillClientId = '', prefillJobId = '', prefillQuoteId = '' }: Props) {
  const [clientId, setClientId] = useState(prefillClientId)
  const [propertyId, setPropertyId] = useState('')
  const [jobId, setJobId] = useState(prefillJobId)
  const [quoteId, setQuoteId] = useState(prefillQuoteId)
  const [issueDate, setIssueDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<BillingLineFormState[]>([createBlankBillingLine()])
  const [status, setStatus] = useState('draft')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicateId, setDuplicateId] = useState<string | null>(null)
  const client = clients.find((item) => item.id === clientId) ?? null
  const subtotal = useMemo(() => calculateBillingSubtotal(lines), [lines])
  const tax = useMemo(() => roundMoney(subtotal * businessRules.defaultTaxRate), [subtotal])
  const total = roundMoney(subtotal + tax)
  const availableProperties = properties.filter((item) => item.client_id === clientId)
  const availableJobs = jobs.filter((item) => item.client_id === clientId)
  const availableQuotes = quotes.filter((item) => item.client_id === clientId)
  function updateLine(index: number, field: keyof BillingLineFormState, value: string) { setLines((current) => current.map((line, itemIndex) => itemIndex === index ? { ...line, [field]: value } : line)) }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(null)
    if (!clientId) return setError('Selecciona un cliente.')
    const linePayloads = buildBillingLinePayloads(lines, (concept) => concept.trim())
    if (!linePayloads?.length) return setError('Añade al menos una línea válida con concepto, cantidad e importe.')
    const id = createLocalId('INVOICE')
    const invoice = { id, display_code: null, invoice_number: null, job_id: jobId || null, job_display_code: jobs.find((item) => item.id === jobId)?.display_code ?? null, quote_id: quoteId || null, quote_display_code: quotes.find((item) => item.id === quoteId)?.display_code ?? null, client_id: clientId, client_display_code: client?.display_code ?? null, client_label: client?.full_name ?? null, property_id: propertyId || null, issue_date: issueDate, status, subtotal, tax_amount: tax, total, notes: notes.trim() || null, internal_notes: null, pricing_metadata: null, payment_status: 'pending' as const, paid_amount: 0, outstanding_amount: total }
    const payloadLines = linePayloads.map((line, index) => ({ ...line, id: createLocalId('INVOICE-LINE'), invoice_id: id, sort_order: index }))
    const duplicates = findInvoiceDuplicateGroups({ ...invoice, billing_concept: payloadLines[0]?.concept ?? null, billing_quantity: payloadLines[0]?.quantity ?? null, billing_unit: payloadLines[0]?.unit ?? null, billing_unit_price: payloadLines[0]?.unit_price ?? null, lines: payloadLines }, invoices)
    if (duplicates.length > 0) { setDuplicateId(duplicates[0]?.records?.[0]?.recordId ?? null); return }
    setBusy(true)
    try { await saveInvoiceWithLines(invoice, payloadLines); await onRefreshData(); await onCompleted() } catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo guardar la factura.') } finally { setBusy(false) }
  }
  return <V3BottomSheet title="Nueva factura" onClose={onCancel}><form className="v3-form" onSubmit={(event) => void submit(event)}><p className="v3-section-copy">Cliente → líneas → importe → revisión. La numeración y el lifecycle siguen el contrato financiero actual.</p><V3Field label="Cliente"><V3Select value={clientId} onChange={(event) => { setClientId(event.target.value); setPropertyId(''); setJobId(''); setQuoteId('') }} required><option value="">Selecciona un cliente</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}</V3Select></V3Field><div className="v3-form-grid"><V3Field label="Inmueble"><V3Select value={propertyId} onChange={(event) => setPropertyId(event.target.value)}><option value="">Sin inmueble</option>{availableProperties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</V3Select></V3Field><V3Field label="Servicio"><V3Select value={jobId} onChange={(event) => setJobId(event.target.value)}><option value="">Sin servicio</option>{availableJobs.map((item) => <option key={item.id} value={item.id}>{item.display_code ?? item.id}</option>)}</V3Select></V3Field></div><V3Field label="Presupuesto origen"><V3Select value={quoteId} onChange={(event) => setQuoteId(event.target.value)}><option value="">Sin presupuesto</option>{availableQuotes.map((item) => <option key={item.id} value={item.id}>{item.display_code ?? item.id}</option>)}</V3Select></V3Field><div className="v3-form-grid"><V3Field label="Fecha"><V3Input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} required /></V3Field><V3Field label="Estado"><V3Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="draft">Borrador</option><option value="issued">Emitida</option></V3Select></V3Field></div>{lines.map((line, index) => <div className="v3-form-grid" key={line.local_id}><V3Field label="Concepto"><V3Input value={line.concept} onChange={(event) => updateLine(index, 'concept', event.target.value)} required /></V3Field><V3Field label="Cantidad"><V3Input inputMode="decimal" value={line.quantity} onChange={(event) => updateLine(index, 'quantity', formatQuantityInput(Number(event.target.value.replace(',', '.'))) || event.target.value)} required /></V3Field><V3Field label="Unidad"><V3Input value={line.unit} onChange={(event) => updateLine(index, 'unit', event.target.value)} required /></V3Field><V3Field label="Precio unitario"><V3Input inputMode="decimal" value={line.unit_price} onChange={(event) => updateLine(index, 'unit_price', event.target.value)} required /></V3Field></div>)}<V3SecondaryAction type="button" onClick={() => setLines((current) => [...current, createBlankBillingLine()])}>Añadir línea</V3SecondaryAction><V3Field label="Notas"><V3Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></V3Field><p className="v3-inline-message">Base {formatMoneyInput(subtotal)} € · IVA {formatMoneyInput(tax)} € · Total {formatMoneyInput(total)} €</p>{error ? <p className="v3-inline-message v3-inline-message--error" role="alert">{error}</p> : null}{duplicateId && onOpenExistingInvoice ? <V3SecondaryAction type="button" onClick={() => onOpenExistingInvoice(duplicateId)}>Abrir factura existente</V3SecondaryAction> : null}<div className="v3-workspace-actions"><V3SecondaryAction type="button" onClick={onCancel}>Cancelar</V3SecondaryAction><V3PrimaryAction type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Crear factura'}</V3PrimaryAction></div></form></V3BottomSheet>
}
