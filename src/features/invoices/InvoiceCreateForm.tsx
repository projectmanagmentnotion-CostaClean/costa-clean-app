import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { businessRules } from '../../app/businessRules'
import { getServiceTypeLabel } from '../../app/displayFormat'
import { formatClientLabel, formatJobLabel, formatPropertyLabel, formatQuoteLabel } from '../../app/relationshipLabels'
import { getStatusOptionLabel, invoiceManualStatusOptions } from '../../app/statusOptions'
import { ContextualCreateSection } from '../../components/ContextualCreateSection'
import { ClientCreateForm } from '../clients/ClientCreateForm'
import type { ClientListItem } from '../clients/types'
import { saveInvoiceWithLines } from '../financial/financialWriteApi'
import { JobCreateForm } from '../jobs/JobCreateForm'
import type { JobListItem } from '../jobs/types'
import { PropertyCreateForm } from '../properties/PropertyCreateForm'
import type { PropertyListItem } from '../properties/types'
import { QuoteCreateForm } from '../quotes/QuoteCreateForm'
import { normalizeLineConcept, simplifyLineConcept } from '../quotes/lineConcepts'
import type { QuoteListItem } from '../quotes/types'
import type { InvoiceCreatePrefill } from './invoiceCreatePrefill'
import type { InvoiceListItem } from './types'

interface InvoiceCreateFormProps {
  clients: ClientListItem[]
  properties: PropertyListItem[]
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  onCreated: () => Promise<void>
  prefill?: InvoiceCreatePrefill | null
  onCreatedInvoice?: (invoice: InvoiceListItem) => void | Promise<void>
}

type InvoiceOriginMode = 'job' | 'quote' | 'manual'

interface FormState {
  origin_mode: InvoiceOriginMode
  job_id: string
  quote_id: string
  client_id: string
  property_id: string
  issue_date: string
  status: string
  notes: string
}

interface LineFormState {
  local_id: string
  concept: string
  quantity: string
  unit: string
  unit_price: string
}

interface LinePayload {
  id: string
  invoice_id: string
  sort_order: number
  concept: string
  quantity: number
  unit: string
  unit_price: number
  line_subtotal: number
}

function todayLocalDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createLocalId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function parseDecimalInput(value: string): number {
  const normalized = value.trim().replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function formatMoneyInput(value: number): string {
  return roundMoney(value).toFixed(2)
}

function formatQuantityInput(value: number): string {
  return roundMoney(value).toFixed(2)
}

function createBlankLine(): LineFormState {
  return {
    local_id: createLocalId('LINE-DRAFT'),
    concept: '',
    quantity: '1.00',
    unit: 'servicio',
    unit_price: '0.00',
  }
}

function createDefaultFormState(): FormState {
  return {
    origin_mode: 'job',
    job_id: '',
    quote_id: '',
    client_id: '',
    property_id: '',
    issue_date: todayLocalDate(),
    status: 'draft',
    notes: '',
  }
}

function buildVisibleInvoiceNotes(): string {
  return [
    'Servicio realizado segun presupuesto aprobado.',
    'Condiciones economicas aplicadas segun presupuesto aceptado.',
    'Precios sin IVA.',
  ].join('\n')
}

function getJobBillingLine(job: JobListItem | null): LineFormState | null {
  if (!job) return null

  const quantity = Number(job.billing_quantity)
  const unitPrice = Number(job.billing_unit_price)

  if (
    !Number.isFinite(quantity) ||
    !Number.isFinite(unitPrice) ||
    quantity <= 0 ||
    unitPrice < 0
  ) {
    return null
  }

  return {
    local_id: createLocalId('LINE-DRAFT'),
    concept: normalizeLineConcept(job.billing_concept, simplifyLineConcept(getServiceTypeLabel(job.service_type))),
    quantity: formatQuantityInput(quantity),
    unit: job.billing_unit?.trim() || 'servicio',
    unit_price: formatMoneyInput(unitPrice),
  }
}

function getQuoteBillingLine(quote: QuoteListItem | null): LineFormState | null {
  if (!quote) return null

  const subtotal = Number(quote.subtotal)
  if (!Number.isFinite(subtotal) || subtotal < 0) return null

  return {
    local_id: createLocalId('LINE-DRAFT'),
    concept: normalizeLineConcept(
      quote.lines?.[0]?.concept ?? quote.quote_lines?.[0]?.concept,
      simplifyLineConcept(
        quote.notes,
        `Servicio segun presupuesto ${quote.display_code ?? quote.id}`,
      ),
    ),
    quantity: '1.00',
    unit: 'servicio',
    unit_price: formatMoneyInput(subtotal),
  }
}

function buildLinesFromPrefill(prefill: InvoiceCreatePrefill): LineFormState[] {
  if (prefill.lines.length === 0) {
    return [createBlankLine()]
  }

  return prefill.lines.map((line) => ({
    local_id: createLocalId('LINE-DRAFT'),
    concept: normalizeLineConcept(line.concept),
    quantity: line.quantity,
    unit: line.unit,
    unit_price: line.unit_price,
  }))
}

function applyPrefillToForm(prefill: InvoiceCreatePrefill): FormState {
  const defaultState = createDefaultFormState()
  const originMode = prefill.origin_kind === 'quote' ? 'quote' : prefill.origin_kind === 'manual' ? 'manual' : 'job'

  return {
    ...defaultState,
    origin_mode: originMode,
    job_id: prefill.job_id,
    quote_id: prefill.quote_id,
    client_id: prefill.client_id,
    property_id: prefill.property_id,
    notes: prefill.notes,
  }
}

function calculateLineSubtotal(line: LineFormState): number {
  const quantity = parseDecimalInput(line.quantity)
  const unitPrice = parseDecimalInput(line.unit_price)
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return Number.NaN
  return roundMoney(quantity * unitPrice)
}

function formatLineSubtotalInput(line: LineFormState): string {
  const lineSubtotal = calculateLineSubtotal(line)
  return Number.isNaN(lineSubtotal) ? '' : formatMoneyInput(lineSubtotal)
}

function calculateSubtotal(lines: LineFormState[]): number {
  return roundMoney(lines.reduce((sum, line) => {
    const lineSubtotal = calculateLineSubtotal(line)
    return Number.isNaN(lineSubtotal) ? sum : sum + lineSubtotal
  }, 0))
}

function buildLinePayloads(lines: LineFormState[], invoiceId: string): LinePayload[] | null {
  const payloads: LinePayload[] = []

  for (const [index, line] of lines.entries()) {
    const concept = normalizeLineConcept(line.concept)
    const quantity = parseDecimalInput(line.quantity)
    const unitPrice = parseDecimalInput(line.unit_price)
    const lineSubtotal = calculateLineSubtotal(line)

    if (!concept || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || !Number.isFinite(lineSubtotal)) {
      return null
    }

    payloads.push({
      id: createLocalId('INVOICE-LINE'),
      invoice_id: invoiceId,
      sort_order: index + 1,
      concept,
      quantity: roundMoney(quantity),
      unit: line.unit.trim() || 'servicio',
      unit_price: roundMoney(unitPrice),
      line_subtotal: lineSubtotal,
    })
  }

  return payloads
}

function getOriginDescription(originMode: InvoiceOriginMode): string {
  switch (originMode) {
    case 'job':
      return 'Ruta principal. Emite la factura desde un servicio real y reutiliza su base de facturacion.'
    case 'quote':
      return 'Ruta secundaria. Factura desde un presupuesto aceptado cuando todavia no existe servicio.'
    case 'manual':
      return 'Excepcion administrativa. Factura directa por cliente y propiedad solo cuando no aplica la ruta operativa normal.'
  }
}

export function InvoiceCreateForm({
  clients,
  properties,
  jobs,
  quotes,
  onCreated,
  prefill = null,
  onCreatedInvoice,
}: InvoiceCreateFormProps) {
  const [form, setForm] = useState<FormState>(() => (
    prefill ? applyPrefillToForm(prefill) : createDefaultFormState()
  ))
  const [lines, setLines] = useState<LineFormState[]>(() => (
    prefill ? buildLinesFromPrefill(prefill) : [createBlankLine()]
  ))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [lastAppliedPrefillId, setLastAppliedPrefillId] = useState<string | null>(prefill?.request_id ?? null)
  const [showClientCreate, setShowClientCreate] = useState(false)
  const [showPropertyCreate, setShowPropertyCreate] = useState(false)
  const [showJobCreate, setShowJobCreate] = useState(false)
  const [showQuoteCreate, setShowQuoteCreate] = useState(false)
  const [showSecondaryRoutes, setShowSecondaryRoutes] = useState(false)

  const availableProperties = useMemo(() => {
    if (!form.client_id) return []
    return properties.filter((property) => property.client_id === form.client_id)
  }, [properties, form.client_id])

  const availableJobs = useMemo(() => jobs.filter((job) => {
    if (form.client_id && job.client_id !== form.client_id) return false
    if (form.property_id && job.property_id !== form.property_id) return false
    if ((job as JobListItem & { invoice_id?: string | null }).invoice_id) return false
    return true
  }), [jobs, form.client_id, form.property_id])

  const availableQuotes = useMemo(() => quotes.filter((quote) => {
    if (form.client_id && quote.client_id !== form.client_id) return false
    if (form.property_id && quote.property_id && quote.property_id !== form.property_id) return false
    return quote.status === 'accepted'
  }), [quotes, form.client_id, form.property_id])

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === form.client_id) ?? null,
    [clients, form.client_id],
  )
  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === form.property_id) ?? null,
    [properties, form.property_id],
  )
  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === form.job_id) ?? null,
    [jobs, form.job_id],
  )
  const selectedQuote = useMemo(() => {
    if (form.origin_mode === 'job') {
      if (!selectedJob?.quote_id) return null
      return quotes.find((quote) => quote.id === selectedJob.quote_id) ?? null
    }

    if (!form.quote_id) return null
    return quotes.find((quote) => quote.id === form.quote_id) ?? null
  }, [form.origin_mode, form.quote_id, quotes, selectedJob])

  const subtotalValue = useMemo(() => calculateSubtotal(lines), [lines])
  const taxAmountValue = useMemo(
    () => roundMoney(subtotalValue * businessRules.defaultTaxRate),
    [subtotalValue],
  )
  const totalValue = useMemo(
    () => roundMoney(subtotalValue + taxAmountValue),
    [subtotalValue, taxAmountValue],
  )
  const isOriginLocked = Boolean(prefill?.job_id || prefill?.quote_id)

  useEffect(() => {
    if (!selectedJob || form.origin_mode !== 'job') return

    setForm((current) => ({
      ...current,
      client_id: selectedJob.client_id,
      property_id: selectedJob.property_id,
      quote_id: selectedJob.quote_id ?? '',
      notes: current.notes.trim() ? current.notes : selectedJob.quote_id ? buildVisibleInvoiceNotes() : '',
    }))

    setLines([getJobBillingLine(selectedJob) ?? getQuoteBillingLine(selectedQuote) ?? createBlankLine()])
  }, [form.origin_mode, selectedJob, selectedQuote])

  useEffect(() => {
    if (!selectedQuote || form.origin_mode !== 'quote') return

    setForm((current) => ({
      ...current,
      client_id: selectedQuote.client_id ?? current.client_id,
      property_id: selectedQuote.property_id ?? current.property_id,
      notes: current.notes.trim() ? current.notes : buildVisibleInvoiceNotes(),
    }))

    setLines([getQuoteBillingLine(selectedQuote) ?? createBlankLine()])
  }, [form.origin_mode, selectedQuote])

  useEffect(() => {
    if (!prefill || prefill.request_id === lastAppliedPrefillId) {
      return
    }

    setForm(applyPrefillToForm(prefill))
    setLines(buildLinesFromPrefill(prefill))
    setSubmitError(null)
    setSuccessMessage(null)
    setLastAppliedPrefillId(prefill.request_id)
  }, [lastAppliedPrefillId, prefill])

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => {
      const next = {
        ...current,
        [field]: value,
      }

      if (field === 'origin_mode') {
        if (value === 'manual') {
          next.job_id = ''
          next.quote_id = ''
        }

        if (value === 'quote') {
          next.job_id = ''
        }
      }

      if (field === 'client_id') {
        next.property_id = ''
        if (current.origin_mode !== 'job') {
          next.quote_id = ''
          next.job_id = ''
        }
      }

      if (field === 'property_id' && current.origin_mode !== 'job') {
        next.quote_id = ''
        if (current.origin_mode === 'manual') {
          next.job_id = ''
        }
      }

      return next
    })
  }

  function updateLine<K extends keyof LineFormState>(
    localId: string,
    field: K,
    value: LineFormState[K],
  ) {
    setLines((current) => current.map((line) => (
      line.local_id === localId ? { ...line, [field]: value } : line
    )))
  }

  function removeLine(localId: string) {
    setLines((current) => (
      current.length > 1 ? current.filter((line) => line.local_id !== localId) : current
    ))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError(null)
    setSuccessMessage(null)
    setIsSubmitting(true)

    try {
      if (form.origin_mode === 'job' && !form.job_id) {
        setSubmitError('Debes seleccionar un servicio.')
        return
      }

      if (form.origin_mode === 'quote' && !form.quote_id) {
        setSubmitError('Debes seleccionar un presupuesto.')
        return
      }

      if (!form.client_id) {
        setSubmitError('Debes seleccionar un cliente.')
        return
      }

      if (!form.issue_date) {
        setSubmitError('Debes indicar la fecha de emision.')
        return
      }

      const invoiceId = createLocalId('INVOICE')
      const linePayloads = buildLinePayloads(lines, invoiceId)

      if (!linePayloads || linePayloads.length === 0) {
        setSubmitError('Cada linea debe tener concepto, cantidad mayor que 0 y precio unitario valido.')
        return
      }

      await saveInvoiceWithLines(
        {
          id: invoiceId,
          job_id: form.origin_mode === 'job' ? form.job_id : null,
          quote_id: selectedQuote?.id ?? (form.origin_mode === 'quote' ? form.quote_id : null),
          client_id: form.client_id,
          property_id: form.property_id || null,
          issue_date: form.issue_date,
          status: form.status,
          subtotal: subtotalValue,
          tax_amount: taxAmountValue,
          total: totalValue,
          notes: form.notes.trim() || null,
          internal_notes: selectedQuote?.internal_notes ?? null,
          pricing_metadata: selectedQuote?.pricing_metadata ?? null,
        },
        linePayloads,
      )

      await onCreated()
      await onCreatedInvoice?.({
        id: invoiceId,
        display_code: null,
        invoice_number: null,
        job_id: form.origin_mode === 'job' ? form.job_id : null,
        quote_id: selectedQuote?.id ?? (form.origin_mode === 'quote' ? form.quote_id : null),
        client_id: form.client_id,
        client_display_code: selectedClient?.display_code ?? null,
        issue_date: form.issue_date,
        status: form.status,
        subtotal: subtotalValue,
        tax_amount: taxAmountValue,
        total: totalValue,
        notes: form.notes.trim() || null,
        internal_notes: selectedQuote?.internal_notes ?? null,
        pricing_metadata: selectedQuote?.pricing_metadata ?? null,
        client_name: selectedClient?.full_name ?? null,
        property_id: form.property_id || null,
        property_display_code: selectedProperty?.display_code ?? null,
        property_name: selectedProperty?.name ?? null,
        service_reference: selectedJob ? formatJobLabel(selectedJob) : selectedQuote ? formatQuoteLabel(selectedQuote) : null,
        service_description: selectedJob?.billing_concept ?? null,
        lines: linePayloads,
      })

      setForm(createDefaultFormState())
      setLines([createBlankLine()])
      setSuccessMessage('Factura creada correctamente.')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error desconocido creando la factura.'

      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="data-section cc-form-shell cc-form-shell--invoice">
      <div className="section-header cc-form-shell__header">
        <div className="cc-form-shell__intro">
          <span className="cc-form-shell__eyebrow">Documento de cobro</span>
          <h2>Nueva factura</h2>
          <p>{getOriginDescription(form.origin_mode)}</p>
        </div>

        <div className="cc-form-shell__summary">
          <div className="cc-form-shell__summary-card">
            <span>Ruta activa</span>
            <strong>{form.origin_mode === 'job' ? 'Servicio -> factura' : form.origin_mode === 'quote' ? 'Presupuesto -> factura' : 'Factura directa'}</strong>
            <small>{selectedJob ? formatJobLabel(selectedJob) : selectedQuote ? formatQuoteLabel(selectedQuote) : 'Sin documento origen'}</small>
          </div>
          <div className="cc-form-shell__summary-card">
            <span>Total actual</span>
            <strong>{formatMoneyInput(totalValue)} €</strong>
            <small>{lines.length} linea(s)</small>
          </div>
        </div>
      </div>

      {clients.length === 0 ? (
        <ContextualCreateSection
          actionLabel="Crear cliente"
          title="Falta el cliente base"
          description="Crea el cliente sin salir del documento y la factura podrá continuar dentro del mismo flujo."
          isOpen={showClientCreate}
          onToggle={() => setShowClientCreate((current) => !current)}
        >
          <ClientCreateForm
            onCreated={onCreated}
            title="Nuevo cliente para esta factura"
            description="El cliente quedará listo para retomar la factura sin perder líneas ni fecha."
            submitLabel="Guardar cliente y continuar"
            onCreatedClient={async (client) => {
              setForm((current) => ({
                ...current,
                client_id: client.id,
              }))
              setShowClientCreate(false)
            }}
          />
        </ContextualCreateSection>
      ) : (
        <form className="lead-form cc-form-shell__grid" onSubmit={handleSubmit}>
          <div className="cc-form-shell__main">
            <section className="cc-form-shell__section">
              <div className="cc-form-shell__section-head">
                <strong>Ruta de facturacion</strong>
                <span>La ruta principal es desde servicio. Las alternativas quedan disponibles como secundaria o excepcion administrativa.</span>
              </div>

              <label className="form-field">
                <span>Ruta principal</span>
                <select
                  value={form.origin_mode}
                  onChange={(event) => updateField('origin_mode', event.target.value as InvoiceOriginMode)}
                  disabled={isOriginLocked}
                >
                  <option value="job">Desde servicio</option>
                  <option value="quote">Desde presupuesto aceptado</option>
                  <option value="manual">Directa administrativa</option>
                </select>
              </label>

              {form.origin_mode === 'job' ? (
                <>
                  <label className="form-field">
                    <span>Servicio *</span>
                    <select
                      value={form.job_id}
                      onChange={(event) => updateField('job_id', event.target.value)}
                    >
                      <option value="">Selecciona un servicio</option>
                      {availableJobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {formatJobLabel(job)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="cc-line-editor-note">Cliente, propiedad y base de facturacion se heredan automaticamente desde el servicio.</p>
                </>
              ) : null}

              {!isOriginLocked ? (
                <details open={form.origin_mode !== 'job' || showSecondaryRoutes} className="cc-form-shell__section">
                  <summary
                    className="secondary-button"
                    onClick={(event) => {
                      event.preventDefault()
                      setShowSecondaryRoutes((current) => !current)
                    }}
                  >
                    {showSecondaryRoutes || form.origin_mode !== 'job' ? 'Ocultar rutas secundarias' : 'Usar ruta secundaria o administrativa'}
                  </summary>

                  {showSecondaryRoutes || form.origin_mode !== 'job' ? (
                    <div style={{ display: 'grid', gap: '0.85rem', marginTop: '0.85rem' }}>
                      <label className="form-field">
                        <span>Ruta alternativa</span>
                        <select
                          value={form.origin_mode}
                          onChange={(event) => updateField('origin_mode', event.target.value as InvoiceOriginMode)}
                        >
                          <option value="job">Volver a servicio</option>
                          <option value="quote">Usar presupuesto aceptado</option>
                          <option value="manual">Usar factura administrativa</option>
                        </select>
                      </label>

                      {form.origin_mode === 'quote' ? (
                        <label className="form-field">
                          <span>Presupuesto aceptado *</span>
                          <select
                            value={form.quote_id}
                            onChange={(event) => updateField('quote_id', event.target.value)}
                          >
                            <option value="">Selecciona un presupuesto</option>
                            {availableQuotes.map((quote) => (
                              <option key={quote.id} value={quote.id}>
                                {formatQuoteLabel(quote)}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </div>
                  ) : null}
                </details>
              ) : null}

              <label className="form-field">
                <span>Cliente *</span>
                <select
                  value={form.client_id}
                  onChange={(event) => updateField('client_id', event.target.value)}
                  disabled={form.origin_mode === 'job' || form.origin_mode === 'quote'}
                >
                  {form.origin_mode === 'manual' ? <option value="">Selecciona un cliente</option> : null}
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {formatClientLabel(client)}
                    </option>
                  ))}
                </select>
              </label>

              {form.origin_mode === 'manual' ? (
                <ContextualCreateSection
                  actionLabel="Crear cliente excepcional"
                  title="Cliente para factura administrativa"
                  description="Para facturación directa, crea el cliente aquí y sigue con la factura sin salir del documento."
                  isOpen={showClientCreate}
                  onToggle={() => setShowClientCreate((current) => !current)}
                >
                  <ClientCreateForm
                    onCreated={onCreated}
                    title="Nuevo cliente para esta factura"
                    description="Se seleccionará automáticamente en la factura manual."
                    submitLabel="Guardar cliente y usarlo"
                    onCreatedClient={async (client) => {
                      setForm((current) => ({
                        ...current,
                        client_id: client.id,
                        property_id: '',
                      }))
                      setShowClientCreate(false)
                    }}
                  />
                </ContextualCreateSection>
              ) : null}

              <label className="form-field">
                <span>Propiedad</span>
                <select
                  value={form.property_id}
                  onChange={(event) => updateField('property_id', event.target.value)}
                  disabled={form.origin_mode === 'job' || form.origin_mode === 'quote'}
                >
                  <option value="">Sin propiedad</option>
                  {availableProperties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {formatPropertyLabel(property)}
                    </option>
                  ))}
                </select>
              </label>

              {form.origin_mode === 'manual' && form.client_id ? (
                <ContextualCreateSection
                  actionLabel="Crear propiedad excepcional"
                  title="Propiedad para factura administrativa"
                  description="Crea la propiedad del cliente actual y asóciala de inmediato a esta factura directa."
                  isOpen={showPropertyCreate}
                  onToggle={() => setShowPropertyCreate((current) => !current)}
                >
                  <PropertyCreateForm
                    clients={clients}
                    onCreated={onCreated}
                    contextClientId={form.client_id}
                    title="Nueva propiedad para esta factura"
                    description="La propiedad quedará fijada sin perder líneas ni fecha de emisión."
                    submitLabel="Guardar propiedad y usarla"
                    onCreatedProperty={async (property) => {
                      setForm((current) => ({
                        ...current,
                        property_id: property.id,
                      }))
                      setShowPropertyCreate(false)
                    }}
                  />
                </ContextualCreateSection>
              ) : null}

              {form.origin_mode === 'job' ? (
                <ContextualCreateSection
                  actionLabel="Crear servicio"
                  title="Servicio en contexto"
                  description="Si aún no existe el servicio facturable, créalo aquí y vuelve a la factura por la ruta principal."
                  isOpen={showJobCreate}
                  onToggle={() => setShowJobCreate((current) => !current)}
                >
                  <JobCreateForm
                    clients={clients}
                    properties={properties}
                    quotes={quotes}
                    onCreated={onCreated}
                    onCreatedJob={async (job) => {
                      setForm((current) => ({
                        ...current,
                        origin_mode: 'job',
                        job_id: job.id,
                        client_id: job.client_id,
                        property_id: job.property_id,
                        quote_id: job.quote_id ?? '',
                      }))
                      setShowJobCreate(false)
                    }}
                  />
                </ContextualCreateSection>
              ) : null}

              {form.origin_mode === 'quote' ? (
                <ContextualCreateSection
                  actionLabel="Crear presupuesto"
                  title="Presupuesto en contexto"
                  description="Si falta el presupuesto aceptado de origen, créalo aquí y mantén la factura como ruta secundaria."
                  isOpen={showQuoteCreate}
                  onToggle={() => setShowQuoteCreate((current) => !current)}
                >
                  <QuoteCreateForm
                    clients={clients}
                    properties={properties}
                    onCreated={onCreated}
                    contextClientId={form.client_id || null}
                    contextPropertyId={form.property_id || null}
                    onCreatedQuote={async (quote) => {
                      setForm((current) => ({
                        ...current,
                        origin_mode: 'quote',
                        quote_id: quote.id,
                        client_id: quote.client_id,
                        property_id: quote.property_id ?? current.property_id,
                      }))
                      setShowQuoteCreate(false)
                    }}
                  />
                </ContextualCreateSection>
              ) : null}

              <label className="form-field">
                <span>Fecha de emision *</span>
                <input
                  type="date"
                  value={form.issue_date}
                  onChange={(event) => updateField('issue_date', event.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span>Estado</span>
                <select
                  value={form.status}
                  onChange={(event) => updateField('status', event.target.value)}
                >
                  {invoiceManualStatusOptions.map((status) => (
                    <option key={status} value={status}>{getStatusOptionLabel(status)}</option>
                  ))}
                </select>
              </label>
            </section>

            <section className="cc-form-shell__section cc-form-shell__section--full">
              <div className="cc-form-shell__section-head">
                <strong>Lineas de cobro</strong>
                <span>Detalle editable con importes visibles y consistente con el origen elegido.</span>
              </div>

              <div className="form-field form-field-full">
                <span>Lineas de factura *</span>
                <div className="cc-form-shell__line-list">
                  {lines.map((line, index) => (
                    <div key={line.local_id} className="lead-form cc-line-editor-row cc-line-editor-row--premium">
                      <label className="form-field form-field-full cc-line-editor-row__concept">
                        <span>Concepto {index + 1}</span>
                        <input
                          value={line.concept}
                          onChange={(event) => updateLine(line.local_id, 'concept', event.target.value)}
                          required
                        />
                      </label>

                      <label className="form-field cc-line-editor-row__field cc-line-editor-row__field--quantity">
                        <span>Cantidad</span>
                        <input
                          value={line.quantity}
                          onChange={(event) => updateLine(line.local_id, 'quantity', event.target.value)}
                          required
                        />
                      </label>

                      <label className="form-field cc-line-editor-row__field cc-line-editor-row__field--unit">
                        <span>Unidad</span>
                        <input
                          value={line.unit}
                          onChange={(event) => updateLine(line.local_id, 'unit', event.target.value)}
                          required
                        />
                      </label>

                      <label className="form-field cc-line-editor-row__field cc-line-editor-row__field--price">
                        <span>Precio unitario</span>
                        <input
                          value={line.unit_price}
                          onChange={(event) => updateLine(line.local_id, 'unit_price', event.target.value)}
                          required
                        />
                      </label>

                      <label className="form-field cc-line-editor-row__field cc-line-editor-row__field--amount">
                        <span>Importe</span>
                        <input value={formatLineSubtotalInput(line)} readOnly />
                      </label>

                      <div className="form-actions form-field-full cc-line-editor-row__actions">
                        <button
                          type="button"
                          className="secondary-button cc-line-editor-row__remove"
                          onClick={() => removeLine(line.local_id)}
                          disabled={lines.length === 1}
                        >
                          Quitar linea
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setLines((current) => [...current, createBlankLine()])}
                >
                  Añadir linea
                </button>
              </div>
            </section>

            <section className="cc-form-shell__section cc-form-shell__section--full">
              <div className="cc-form-shell__section-head">
                <strong>Notas visibles</strong>
                <span>Condiciones o texto contextual del documento.</span>
              </div>

              <label className="form-field form-field-full">
                <span>Notas</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                  rows={4}
                  placeholder="Notas o condiciones de la factura"
                />
              </label>
            </section>

            {submitError ? (
              <div className="cc-alert cc-alert--error">
                <strong>No se pudo crear la factura</strong>
                <p>{submitError}</p>
              </div>
            ) : null}

            {successMessage ? (
              <div className="cc-alert cc-alert--success">
                <strong>Operacion correcta</strong>
                <p>{successMessage}</p>
              </div>
            ) : null}
          </div>

          <aside className="cc-form-shell__aside">
            <div className="cc-form-shell__sticky">
              <div className="cc-form-shell__totals">
                <div className="cc-form-shell__totals-row">
                  <span>Subtotal</span>
                  <strong>{formatMoneyInput(subtotalValue)} €</strong>
                </div>
                <div className="cc-form-shell__totals-row">
                  <span>IVA</span>
                  <strong>{formatMoneyInput(taxAmountValue)} €</strong>
                </div>
                <div className="cc-form-shell__totals-row cc-form-shell__totals-row--grand">
                  <span>Total</span>
                  <strong>{formatMoneyInput(totalValue)} €</strong>
                </div>
              </div>

              <div className="cc-form-shell__summary-card cc-form-shell__summary-card--stack">
                <span>Contexto</span>
                <strong>{selectedClient ? formatClientLabel(selectedClient) : 'Cliente pendiente'}</strong>
                <small>{selectedProperty ? formatPropertyLabel(selectedProperty) : 'Sin propiedad fija'}</small>
              </div>

              <div className="cc-form-shell__summary-card cc-form-shell__summary-card--stack">
                <span>Salida</span>
                <strong>Factura lista</strong>
                <small>
                  {form.origin_mode === 'manual'
                    ? 'Se emitira como documento directo de cliente y propiedad.'
                    : 'Se emitira con su relacion de origen conservada.'}
                </small>
              </div>

              <div className="form-actions cc-form-shell__actions">
                <button type="submit" className="primary-button" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : 'Guardar factura'}
                </button>
              </div>
            </div>
          </aside>
        </form>
      )}
    </section>
  )
}
