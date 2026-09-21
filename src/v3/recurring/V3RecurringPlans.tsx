import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { formatCurrency, formatDateEs } from '../../app/displayFormat'
import { formatPropertyLabel, formatQuoteLabel } from '../../app/relationshipLabels'
import { findRecurringPlanDuplicateGroups } from '../../features/duplicates/duplicateEngine'
import { buildQuoteLinePayloads, calculateQuoteSubtotal, createBlankQuoteLine, createLocalId, formatMoneyInput, formatQuoteLineSubtotalInput, roundMoney, type QuoteLineFormState } from '../../features/quotes/quoteLineUtils'
import { buildRecurringPlanPersistenceInput } from '../../features/recurringInvoices/planPersistence'
import { generateInvoiceFromRecurringPlan, saveRecurringInvoicePlan } from '../../features/recurringInvoices/recurringInvoiceApi'
import { calculateNextRecurringIssueDate, getRecurringFrequencyLabel, isRecurringPlanDue } from '../../features/recurringInvoices/recurringInvoiceSchedule'
import type { RecurringInvoiceFrequency, RecurringInvoicePlanInvoiceStatus, RecurringInvoicePlanListItem, RecurringInvoicePlanStatus } from '../../features/recurringInvoices/types'
import type { ClientListItem } from '../../features/clients/types'
import type { PropertyListItem } from '../../features/properties/types'
import type { QuoteListItem } from '../../features/quotes/types'
import { V3BottomSheet, V3ConfirmSheet, V3DetailSection, V3EmptyState, V3EntityList, V3EntityListItem, V3EntityStatus, V3Field, V3Input, V3ListWorkspace, V3PageTitle, V3PrimaryAction, V3SecondaryAction, V3Section, V3Select, V3Summary, V3Textarea } from '../components/V3Primitives'
import { useV3ListWindow } from '../components/useV3ListWindow'
import { V3DuplicateReviewSheet } from '../components/V3DuplicateReviewSheet'

interface V3RecurringPlansProps {
  client: ClientListItem
  plans: RecurringInvoicePlanListItem[]
  properties: PropertyListItem[]
  quotes: QuoteListItem[]
  onRefresh: () => Promise<void>
  onOpenProperty: (propertyId: string) => void
  onOpenQuote: (quoteId: string) => void
  onOpenInvoice: (invoiceId: string) => void
  onPendingStateChange?: (pending: boolean) => void
}

function planStatusLabel(status: RecurringInvoicePlanStatus): string {
  if (status === 'paused') return 'Pausado'
  if (status === 'archived') return 'Archivado'
  return 'Activo'
}

function planStatusTone(status: RecurringInvoicePlanStatus): 'neutral' | 'success' | 'warning' {
  if (status === 'active') return 'success'
  if (status === 'paused') return 'warning'
  return 'neutral'
}

function invoiceStatusLabel(status: RecurringInvoicePlanInvoiceStatus): string {
  return status === 'issued' ? 'Emitida' : 'Borrador'
}

function getPlanTotal(plan: RecurringInvoicePlanListItem): number {
  return roundMoney((plan.template_lines ?? []).reduce((sum, line) => sum + Number(line.line_subtotal ?? 0), 0) * (1 + Number(plan.tax_rate ?? 0)))
}

function getPlanDueLabel(plan: RecurringInvoicePlanListItem): string {
  if (plan.status === 'archived') return 'Emisión no programada'
  if (plan.status === 'paused') return 'Emisión pausada'
  return isRecurringPlanDue(plan.next_issue_date)
    ? 'Emisión pendiente'
    : `Siguiente emisión ${formatDateEs(plan.next_issue_date)}`
}

function getPlanEmissionStatus(plan: RecurringInvoicePlanListItem): { label: string; tone: 'neutral' | 'warning' } {
  if (plan.status === 'archived') return { label: 'No programada', tone: 'neutral' }
  if (plan.status === 'paused') return { label: 'Pausada', tone: 'warning' }
  return isRecurringPlanDue(plan.next_issue_date)
    ? { label: 'Pendiente', tone: 'warning' }
    : { label: 'Programada', tone: 'neutral' }
}

export function V3RecurringPlansSection({ client, plans, properties, quotes, onRefresh, onOpenProperty, onOpenQuote, onOpenInvoice, onPendingStateChange }: V3RecurringPlansProps) {
  const [openPlanId, setOpenPlanId] = useState<string | null>(null)
  const [flow, setFlow] = useState<'create' | 'edit' | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const selectedPlan = plans.find((plan) => plan.id === openPlanId) ?? null
  const relatedPlans = useMemo(() => plans.filter((plan) => plan.client_id === client.id), [client.id, plans])
  const listWindow = useV3ListWindow(relatedPlans, { resetKey: client.id })

  async function refreshAndNotify(nextMessage?: string) {
    await onRefresh()
    setMessage(nextMessage ?? null)
  }

  return (
    <V3Section
      label="Planes recurrentes"
      action={<V3SecondaryAction onClick={() => { setMessage(null); setFlow('create') }}>+ Nuevo plan</V3SecondaryAction>}
    >
      {message ? <p className="v3-inline-message" role="status">{message}</p> : null}
      {relatedPlans.length === 0 ? (
        <V3EmptyState title="Sin planes recurrentes" description="Crea un plan para gestionar emisiones periódicas desde este cliente." />
      ) : (
        <V3ListWorkspace label="Planes recurrentes del cliente" {...listWindow} onPageChange={listWindow.setPage}>
          <V3EntityList label="Planes recurrentes del cliente">
          {listWindow.pageItems.map((plan) => (
            <V3EntityListItem
              key={plan.id}
              ariaLabel={`Abrir plan recurrente ${plan.title}`}
              onClick={() => { setMessage(null); setOpenPlanId(plan.id) }}
              className="v3-recurring-plan-row"
            >
              <div className="v3-operational-row__identity">
                <strong>{plan.title}</strong>
                <span>{getRecurringFrequencyLabel(plan.frequency)} · {getPlanDueLabel(plan)}</span>
              </div>
              <div className="v3-operational-row__context">
                <strong className="v3-operational-row__value">{formatCurrency(getPlanTotal(plan))}</strong>
                <div className="v3-operational-statuses"><V3EntityStatus context="Plan" label={planStatusLabel(plan.status)} tone={planStatusTone(plan.status)} /><V3EntityStatus context="Emisión" {...getPlanEmissionStatus(plan)} /></div>
              </div>
            </V3EntityListItem>
          ))}
          </V3EntityList>
        </V3ListWorkspace>
      )}

      {selectedPlan ? (
        <V3RecurringPlanWorkspace
          plan={selectedPlan}
          properties={properties}
          quotes={quotes}
          onClose={() => setOpenPlanId(null)}
          onEdit={() => setFlow('edit')}
          onRefresh={onRefresh}
          onOpenProperty={onOpenProperty}
          onOpenQuote={onOpenQuote}
          onOpenInvoice={onOpenInvoice}
          onPendingStateChange={onPendingStateChange}
        />
      ) : null}
      {flow ? (
        <V3RecurringPlanFlow
          client={client}
          plans={relatedPlans}
          properties={properties}
          quotes={quotes}
          initialPlan={flow === 'edit' ? selectedPlan : null}
          onCancel={() => setFlow(null)}
          onSaved={async () => { setFlow(null); setOpenPlanId(null); await refreshAndNotify('Plan recurrente guardado.') }}
          onOpenExistingPlan={(planId) => { setFlow(null); setOpenPlanId(planId) }}
          onDirtyChange={onPendingStateChange}
        />
      ) : null}
    </V3Section>
  )
}

interface V3RecurringPlanWorkspaceProps {
  plan: RecurringInvoicePlanListItem
  properties: PropertyListItem[]
  quotes: QuoteListItem[]
  onClose: () => void
  onEdit: () => void
  onRefresh: () => Promise<void>
  onOpenProperty: (propertyId: string) => void
  onOpenQuote: (quoteId: string) => void
  onOpenInvoice: (invoiceId: string) => void
  onPendingStateChange?: (pending: boolean) => void
}

export function V3RecurringPlanWorkspace({ plan, properties, quotes, onClose, onEdit, onRefresh, onOpenProperty, onOpenQuote, onOpenInvoice, onPendingStateChange }: V3RecurringPlanWorkspaceProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pendingStatus, setPendingStatus] = useState<RecurringInvoicePlanStatus | null>(null)
  const [generationRequested, setGenerationRequested] = useState(false)
  const property = plan.property_id ? properties.find((item) => item.id === plan.property_id) ?? null : null
  const quote = plan.quote_id ? quotes.find((item) => item.id === plan.quote_id) ?? null : null

  useEffect(() => {
    onPendingStateChange?.(busy)
    return () => onPendingStateChange?.(false)
  }, [busy, onPendingStateChange])

  async function persistStatus(status: RecurringInvoicePlanStatus) {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await saveRecurringInvoicePlan(buildRecurringPlanPersistenceInput(plan, { status }))
      await onRefresh()
      setMessage(`Plan ${planStatusLabel(status).toLocaleLowerCase()} correctamente.`)
      setPendingStatus(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el plan recurrente.')
    } finally {
      setBusy(false)
    }
  }

  async function generateInvoice() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await generateInvoiceFromRecurringPlan(plan.id)
      await onRefresh()
      onOpenInvoice(result.invoice_id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo generar la factura recurrente.')
    } finally {
      setBusy(false)
    }
  }

  if (pendingStatus) {
    return (
      <V3ConfirmSheet
        title={`${planStatusLabel(pendingStatus)} plan recurrente`}
        description={`El plan pasará a estado ${planStatusLabel(pendingStatus).toLocaleLowerCase()} mediante el contrato recurrente protegido.`}
        confirmLabel={planStatusLabel(pendingStatus)}
        busy={busy}
        onCancel={() => setPendingStatus(null)}
        onConfirm={() => void persistStatus(pendingStatus)}
      />
    )
  }

  const scheduleDescription = plan.status === 'active'
    ? isRecurringPlanDue(plan.next_issue_date)
      ? 'La fecha prevista ya ha llegado; revisa el contexto antes de solicitar una emisión.'
      : `La próxima emisión está programada para ${formatDateEs(plan.next_issue_date)}.`
    : plan.status === 'paused'
      ? 'La emisión permanece pausada hasta que reanudes el plan.'
      : 'El plan está archivado y no tiene una emisión programada.'

  if (generationRequested) {
    return (
      <V3ConfirmSheet
        title="Generar factura desde el plan"
        description="Se solicitará la emisión mediante el flujo recurrente protegido. La factura solo se mostrará cuando ese flujo confirme que se ha generado correctamente."
        confirmLabel="Generar factura"
        busy={busy}
        onCancel={() => setGenerationRequested(false)}
        onConfirm={() => { setGenerationRequested(false); void generateInvoice() }}
      />
    )
  }

  return (
    <V3BottomSheet title="Plan recurrente" variant="workspace" closeLabel="Volver a planes" onClose={onClose}>
      <div className="v3-workspace-actions">
        <V3EntityStatus context="Estado del plan" label={planStatusLabel(plan.status)} tone={planStatusTone(plan.status)} />
        {plan.status === 'active' ? <V3SecondaryAction onClick={() => setPendingStatus('paused')} disabled={busy}>Pausar</V3SecondaryAction> : null}
        {plan.status === 'paused' ? <V3SecondaryAction onClick={() => setPendingStatus('active')} disabled={busy}>Reanudar</V3SecondaryAction> : null}
        {plan.status !== 'archived' ? <V3SecondaryAction onClick={() => setPendingStatus('archived')} disabled={busy}>Archivar</V3SecondaryAction> : null}
      </div>
      <V3PageTitle eyebrow="Plan recurrente" title={plan.title} description={`${plan.client_display_code ? `${plan.client_display_code} · ` : ''}${plan.client_name ?? 'Cliente no disponible'}`} />
      {error ? <p className="v3-inline-message v3-inline-message--error" role="alert">{error}</p> : null}
      {message ? <p className="v3-inline-message" role="status">{message}</p> : null}
      <V3Summary>
        <div><span>Cadencia</span><strong>{getRecurringFrequencyLabel(plan.frequency)}</strong></div>
        <div><span>Próxima emisión</span><strong>{plan.status === 'active' ? formatDateEs(plan.next_issue_date) : 'No programada'}</strong></div>
        <div><span>Última emisión</span><strong>{plan.last_issued_at ? formatDateEs(plan.last_issued_at) : 'Aún no emitida'}</strong></div>
        <div><span>Estado al emitir</span><strong>{invoiceStatusLabel(plan.default_invoice_status)}</strong></div>
      </V3Summary>
      <p className="v3-section-copy v3-recurring-plan-workspace__schedule">{scheduleDescription}</p>
      <V3DetailSection title="Relaciones">
        <div className="v3-workspace-actions">
          {property ? <V3SecondaryAction onClick={() => onOpenProperty(property.id)}>Inmueble: {formatPropertyLabel(property)}</V3SecondaryAction> : <span>Sin inmueble fijo</span>}
          {quote ? <V3SecondaryAction onClick={() => onOpenQuote(quote.id)}>Presupuesto: {formatQuoteLabel(quote)}</V3SecondaryAction> : <span>Sin presupuesto fijo</span>}
        </div>
      </V3DetailSection>
      <V3DetailSection title="Plantilla de factura">
        <div className="v3-relation-list">
          {plan.template_lines.map((line, index) => <div className="v3-relation-row" key={`${plan.id}-${index}`}><span><strong>{line.concept}</strong><small>{line.quantity} {line.unit} · {formatCurrency(line.unit_price)}</small></span><strong>{formatCurrency(line.line_subtotal)}</strong></div>)}
        </div>
        <p className="v3-section-copy">Total estimado con IVA: {formatCurrency(getPlanTotal(plan))}</p>
      </V3DetailSection>
      {plan.notes ? <V3DetailSection title="Notas"><p className="v3-section-copy">{plan.notes}</p></V3DetailSection> : null}
      <div className="v3-workspace-actions">
        <V3SecondaryAction onClick={onEdit} disabled={busy}>Editar</V3SecondaryAction>
        <V3PrimaryAction onClick={() => setGenerationRequested(true)} disabled={busy || plan.status !== 'active'}>{busy ? 'Procesando…' : 'Generar factura'}</V3PrimaryAction>
      </div>
      {plan.status !== 'active' ? <p className="v3-section-copy">Generar factura estará disponible al reanudar el plan.</p> : null}
    </V3BottomSheet>
  )
}

interface V3RecurringPlanFlowProps {
  client: ClientListItem
  plans: RecurringInvoicePlanListItem[]
  properties: PropertyListItem[]
  quotes: QuoteListItem[]
  initialPlan: RecurringInvoicePlanListItem | null
  onCancel: () => void
  onSaved: () => Promise<void>
  onOpenExistingPlan: (planId: string) => void
  onDirtyChange?: (dirty: boolean) => void
}

interface RecurringFormState {
  property_id: string
  quote_id: string
  title: string
  frequency: RecurringInvoiceFrequency
  default_invoice_status: RecurringInvoicePlanInvoiceStatus
  next_issue_date: string
  tax_rate: string
  notes: string
  internal_notes: string
}

function todayLocalDate(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function initialForm(plan: RecurringInvoicePlanListItem | null): RecurringFormState {
  return plan
    ? { property_id: plan.property_id ?? '', quote_id: plan.quote_id ?? '', title: plan.title, frequency: plan.frequency, default_invoice_status: plan.default_invoice_status, next_issue_date: plan.next_issue_date, tax_rate: formatMoneyInput(plan.tax_rate * 100), notes: plan.notes ?? '', internal_notes: plan.internal_notes ?? '' }
    : { property_id: '', quote_id: '', title: '', frequency: 'monthly', default_invoice_status: 'draft', next_issue_date: todayLocalDate(), tax_rate: '21', notes: '', internal_notes: '' }
}

function parsePercent(value: string): number {
  const parsed = Number(value.trim().replace(',', '.'))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed / 100 : Number.NaN
}

function V3RecurringPlanFlow({ client, plans, properties, quotes, initialPlan, onCancel, onSaved, onOpenExistingPlan, onDirtyChange }: V3RecurringPlanFlowProps) {
  const [form, setForm] = useState<RecurringFormState>(() => initialForm(initialPlan))
  const [lines, setLines] = useState<QuoteLineFormState[]>(() => initialPlan?.template_lines.map((line) => ({ local_id: createLocalId('V3-RECURRING-LINE'), concept: line.concept, quantity: formatMoneyInput(line.quantity), unit: line.unit, unit_price: formatMoneyInput(line.unit_price) })) ?? [createBlankQuoteLine()])
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicateGroups, setDuplicateGroups] = useState<ReturnType<typeof findRecurringPlanDuplicateGroups>>([])
  const [discardOpen, setDiscardOpen] = useState(false)

  useEffect(() => {
    onDirtyChange?.(dirty || busy)
    return () => onDirtyChange?.(false)
  }, [busy, dirty, onDirtyChange])

  const availableProperties = properties.filter((property) => property.client_id === client.id)
  const availableQuotes = quotes.filter((quote) => quote.client_id === client.id && (!form.property_id || quote.property_id === form.property_id))
  const subtotal = useMemo(() => calculateQuoteSubtotal(lines), [lines])
  const taxRate = parsePercent(form.tax_rate)
  const taxAmount = Number.isFinite(taxRate) ? roundMoney(subtotal * taxRate) : 0

  function updateForm<K extends keyof RecurringFormState>(key: K, value: RecurringFormState[K]) {
    setDirty(true)
    setForm((current) => ({ ...current, [key]: value, ...(key === 'property_id' ? { quote_id: '' } : {}) }))
  }

  function updateLine(localId: string, key: keyof QuoteLineFormState, value: string) {
    setDirty(true)
    setLines((current) => current.map((line) => line.local_id === localId ? { ...line, [key]: value } : line))
  }

  async function submit(skipDuplicateCheck = false) {
    setError(null)
    const parsedTaxRate = parsePercent(form.tax_rate)
    const linePayloads = buildQuoteLinePayloads(lines, 'V3-RECURRING-TEMPLATE')
    if (!form.title.trim()) return setError('Debes indicar un título para el plan recurrente.')
    if (!form.next_issue_date) return setError('Debes indicar la próxima fecha de emisión.')
    if (!Number.isFinite(parsedTaxRate)) return setError('El tipo de IVA debe ser un porcentaje válido.')
    if (!linePayloads?.length) return setError('Añade al menos una línea válida a la plantilla.')

    const property = properties.find((item) => item.id === form.property_id) ?? null
    const quote = quotes.find((item) => item.id === form.quote_id) ?? null
    const nextPlan: RecurringInvoicePlanListItem = {
      id: initialPlan?.id ?? createLocalId('RECURRING-PLAN'),
      client_id: client.id,
      client_display_code: client.display_code ?? null,
      client_name: client.full_name,
      property_id: form.property_id || null,
      property_display_code: property?.display_code ?? null,
      property_name: property?.name ?? null,
      quote_id: form.quote_id || null,
      quote_display_code: quote?.display_code ?? null,
      title: form.title.trim(),
      frequency: form.frequency,
      status: initialPlan?.status ?? 'active',
      default_invoice_status: form.default_invoice_status,
      next_issue_date: form.next_issue_date,
      last_issued_at: initialPlan?.last_issued_at ?? null,
      tax_rate: parsedTaxRate,
      notes: form.notes.trim() || null,
      internal_notes: form.internal_notes.trim() || null,
      pricing_metadata: { preview_subtotal: subtotal, preview_tax_amount: taxAmount, preview_total: roundMoney(subtotal + taxAmount), next_cycle_preview: calculateNextRecurringIssueDate(form.frequency, form.next_issue_date) },
      template_lines: linePayloads.map((line) => ({ concept: line.concept, quantity: line.quantity, unit: line.unit, unit_price: line.unit_price, line_subtotal: line.line_subtotal })),
    }
    if (!skipDuplicateCheck) {
      const duplicates = findRecurringPlanDuplicateGroups(nextPlan, plans)
      if (duplicates.length) return setDuplicateGroups(duplicates)
    }
    setBusy(true)
    try {
      await saveRecurringInvoicePlan(nextPlan as unknown as Record<string, unknown>)
      setDirty(false)
      await onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el plan recurrente.')
    } finally {
      setBusy(false)
    }
  }

  function requestClose() {
    if (dirty && !busy) setDiscardOpen(true)
    else if (!busy) onCancel()
  }

  if (discardOpen) return <V3ConfirmSheet title="Descartar cambios" description="Hay cambios sin guardar en este plan recurrente." confirmLabel="Descartar" onCancel={() => setDiscardOpen(false)} onConfirm={onCancel} />
  if (duplicateGroups.length) return <V3DuplicateReviewSheet title="Posible plan recurrente duplicado" description="Revisa la coincidencia antes de guardar otra automatización." groups={duplicateGroups} onClose={() => setDuplicateGroups([])} onOpenRecord={(id) => { setDuplicateGroups([]); onOpenExistingPlan(id) }} onContinueAnyway={() => { setDuplicateGroups([]); void submit(true) }} />

  return (
    <V3BottomSheet title={initialPlan ? 'Editar plan recurrente' : 'Nuevo plan recurrente'} onClose={requestClose}>
      <form className="v3-form" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void submit() }}>
        <V3Field label="Cliente"><V3Input value={`${client.display_code ?? 'Cliente'} · ${client.full_name}`} readOnly /></V3Field>
        <V3Field label="Título"><V3Input value={form.title} onChange={(event) => updateForm('title', event.target.value)} autoFocus required /></V3Field>
        <V3Field label="Inmueble"><V3Select value={form.property_id} onChange={(event) => updateForm('property_id', event.target.value)}><option value="">Sin inmueble fijo</option>{availableProperties.map((property) => <option key={property.id} value={property.id}>{formatPropertyLabel(property)}</option>)}</V3Select></V3Field>
        <V3Field label="Presupuesto de referencia"><V3Select value={form.quote_id} onChange={(event) => updateForm('quote_id', event.target.value)}><option value="">Sin presupuesto fijo</option>{availableQuotes.map((quote) => <option key={quote.id} value={quote.id}>{formatQuoteLabel(quote)}</option>)}</V3Select></V3Field>
        <V3Field label="Cadencia"><V3Select value={form.frequency} onChange={(event) => updateForm('frequency', event.target.value as RecurringInvoiceFrequency)}>{(['weekly', 'biweekly', 'monthly', 'quarterly'] as const).map((frequency) => <option key={frequency} value={frequency}>{getRecurringFrequencyLabel(frequency)}</option>)}</V3Select></V3Field>
        <V3Field label="Próxima emisión"><V3Input type="date" value={form.next_issue_date} onChange={(event) => updateForm('next_issue_date', event.target.value)} required /></V3Field>
        <V3Field label="Factura por defecto"><V3Select value={form.default_invoice_status} onChange={(event) => updateForm('default_invoice_status', event.target.value as RecurringInvoicePlanInvoiceStatus)}><option value="draft">Borrador</option><option value="issued">Emitida</option></V3Select></V3Field>
        <V3Field label="IVA (%)"><V3Input inputMode="decimal" value={form.tax_rate} onChange={(event) => updateForm('tax_rate', event.target.value)} /></V3Field>
        <V3DetailSection title="Líneas de plantilla">
          {lines.map((line, index) => <div className="v3-relation-row" key={line.local_id}><V3Field label={`Concepto ${index + 1}`}><V3Input value={line.concept} onChange={(event) => updateLine(line.local_id, 'concept', event.target.value)} required /></V3Field><V3Field label="Cantidad"><V3Input value={line.quantity} onChange={(event) => updateLine(line.local_id, 'quantity', event.target.value)} required /></V3Field><V3Field label="Unidad"><V3Input value={line.unit} onChange={(event) => updateLine(line.local_id, 'unit', event.target.value)} required /></V3Field><V3Field label="Precio"><V3Input inputMode="decimal" value={line.unit_price} onChange={(event) => updateLine(line.local_id, 'unit_price', event.target.value)} required /></V3Field><span>Importe {formatQuoteLineSubtotalInput(line)}</span><V3SecondaryAction onClick={() => { if (lines.length > 1) { setDirty(true); setLines((current) => current.filter((item) => item.local_id !== line.local_id)) } }} disabled={lines.length === 1}>Quitar línea</V3SecondaryAction></div>)}
          <V3SecondaryAction onClick={() => { setDirty(true); setLines((current) => [...current, createBlankQuoteLine()]) }}>Añadir línea</V3SecondaryAction>
        </V3DetailSection>
        <V3Field label="Notas visibles"><V3Textarea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} /></V3Field>
        <V3Field label="Notas internas"><V3Textarea value={form.internal_notes} onChange={(event) => updateForm('internal_notes', event.target.value)} /></V3Field>
        {error ? <p className="v3-inline-message v3-inline-message--error" role="alert">{error}</p> : null}
        <p className="v3-section-copy">Total estimado: {formatCurrency(roundMoney(subtotal + taxAmount))}</p>
        <div className="v3-workspace-actions"><V3SecondaryAction onClick={requestClose} disabled={busy}>Cancelar</V3SecondaryAction><V3PrimaryAction type="submit" disabled={busy}>{busy ? 'Guardando…' : initialPlan ? 'Guardar cambios' : 'Guardar plan'}</V3PrimaryAction></div>
      </form>
    </V3BottomSheet>
  )
}
