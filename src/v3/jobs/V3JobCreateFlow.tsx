import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { formatClientLabel, formatPropertyLabel, formatQuoteLabel } from '../../app/relationshipLabels'
import { findJobDuplicateGroups } from '../../features/duplicates/duplicateEngine'
import { buildJobLinePayloads, buildJobBillingSummary, saveJobWithLines } from '../../features/jobs/jobWriteApi'
import { buildBillingLinePayloads, createBlankBillingLine, type BillingLineFormState } from '../../features/shared/billingLineDrafts'
import { getBillingDraftLinesFromQuote } from '../../features/shared/quoteBillingDrafts'
import type { ClientListItem } from '../../features/clients/types'
import type { PropertyListItem } from '../../features/properties/types'
import type { QuoteListItem } from '../../features/quotes/types'
import type { JobListItem } from '../../features/jobs/types'
import type { JobCreatePrefill } from '../../features/jobs/jobCreatePrefill'
import { completeFullViewActionFlow, type FullViewActionFlowProps } from '../../features/shared/actionFlowLifecycle'
import { getServiceTypeLabel } from '../../app/displayFormat'
import { V3BottomSheet, V3Field, V3Input, V3PrimaryAction, V3SecondaryAction, V3Select, V3Textarea } from '../components/V3Primitives'

interface V3JobCreateFlowProps extends FullViewActionFlowProps {
  clients: ClientListItem[]
  properties: PropertyListItem[]
  quotes: QuoteListItem[]
  jobs?: JobListItem[]
  prefill?: JobCreatePrefill | null
  onCreatedJob?: (job: JobListItem) => void | Promise<void>
  onOpenExistingJob?: (jobId: string) => void
}

const statusOptions = [['pending', 'Pendiente'], ['scheduled', 'Programado'], ['in_progress', 'En curso'], ['completed', 'Realizado']] as const
const serviceOptions = [['standard_cleaning', 'Limpieza estándar'], ['deep_cleaning', 'Limpieza profunda'], ['post_construction', 'Limpieza fin de obra'], ['check_out_cleaning', 'Limpieza check-out'], ['airbnb_turnover', 'Cambio Airbnb'], ['glass_cleaning', 'Limpieza de cristales']] as const

function newId(prefix: string) {
  return `${prefix}-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`
}

function initialForm(prefill: JobCreatePrefill | null | undefined) {
  return {
    client_id: prefill?.client_id ?? '', property_id: prefill?.property_id ?? '', quote_id: prefill?.quote_id ?? '',
    scheduled_date: '', status: 'scheduled', service_type: prefill?.service_type ?? 'standard_cleaning', notes: prefill?.notes ?? '',
  }
}

export function V3JobCreateFlow({ clients, properties, quotes, jobs = [], prefill = null, onRefreshData, onCompleted, onCreatedJob, onOpenExistingJob, onCancel, onDirtyChange }: V3JobCreateFlowProps) {
  const [form, setForm] = useState(() => initialForm(prefill))
  const [lines, setLines] = useState<BillingLineFormState[]>(() => prefill?.billing_lines?.length
    ? prefill.billing_lines.map((line) => createBlankBillingLine({ concept: line.concept, quantity: line.quantity, unit: line.unit, unit_price: line.unit_price }))
    : [createBlankBillingLine({ concept: prefill?.billing_concept ?? '', unit_price: '' })])
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [duplicateJobId, setDuplicateJobId] = useState<string | null>(null)

  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false) }, [dirty, onDirtyChange])
  useEffect(() => { setForm(initialForm(prefill)); setDirty(false) }, [prefill])

  const availableProperties = useMemo(() => form.client_id ? properties.filter((property) => property.client_id === form.client_id) : [], [form.client_id, properties])
  const availableQuotes = useMemo(() => quotes.filter((quote) => quote.client_id === form.client_id && quote.status === 'accepted' && (!form.property_id || quote.property_id === form.property_id || quote.property_id === null)), [form.client_id, form.property_id, quotes])
  const selectedClient = clients.find((client) => client.id === form.client_id) ?? null
  const selectedProperty = properties.find((property) => property.id === form.property_id) ?? null
  const selectedQuote = quotes.find((quote) => quote.id === form.quote_id) ?? null

  function update(field: keyof ReturnType<typeof initialForm>, value: string) {
    setDirty(true); setMessage(null)
    setForm((current) => ({ ...current, [field]: value, ...(field === 'client_id' ? { property_id: '', quote_id: '' } : {}), ...(field === 'property_id' ? { quote_id: '' } : {}) }))
  }

  function chooseQuote(value: string) {
    update('quote_id', value)
    const quote = quotes.find((item) => item.id === value)
    if (quote) setLines(getBillingDraftLinesFromQuote(quote))
  }

  function updateLine(field: keyof BillingLineFormState, value: string) { setDirty(true); setLines((current) => current.map((line, index) => index === 0 ? { ...line, [field]: value } : line)) }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(null)
    const payloads = buildBillingLinePayloads(lines, (value) => value.trim())
    if (!form.client_id || !form.property_id || !form.scheduled_date || !payloads?.length) { setMessage('Completa cliente, inmueble, fecha y una línea de cobro válida.'); return }
    setBusy(true)
    try {
      const id = newId('JOB')
      const summary = buildJobBillingSummary(payloads, getServiceTypeLabel(form.service_type))
      const created: JobListItem = { id, display_code: null, client_id: form.client_id, client_display_code: selectedClient?.display_code ?? null, client_name: selectedClient?.full_name ?? null, property_id: form.property_id, property_display_code: selectedProperty?.display_code ?? null, property_name: selectedProperty?.name ?? null, quote_id: form.quote_id || null, quote_display_code: selectedQuote?.display_code ?? null, scheduled_date: form.scheduled_date, status: form.status, service_type: form.service_type, billing_concept: summary.billing_concept, billing_quantity: summary.billing_quantity, billing_unit: summary.billing_unit, billing_unit_price: summary.billing_unit_price, billing_lines: payloads, notes: form.notes.trim() || null }
      const duplicates = findJobDuplicateGroups(created, jobs)
      if (duplicates.length) { setDuplicateJobId(duplicates[0]?.records.find((record) => record.recordId !== id)?.recordId ?? null); setMessage('Ya existe un servicio con el mismo contexto. Revisa el existente antes de crear otro.'); return }
      await saveJobWithLines({ ...created }, buildJobLinePayloads(payloads, id))
      await onCreatedJob?.(created); setDirty(false)
      await completeFullViewActionFlow({ onRefreshData, onCompleted })
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo guardar el servicio.') } finally { setBusy(false) }
  }

  function close() { if (!dirty || !onCancel) { onCancel?.(); return } setMessage('Hay cambios sin guardar. Pulsa Cancelar de nuevo para cerrar.') ; setDirty(false) }

  return <V3BottomSheet title="Nuevo servicio" onClose={close}><form className="v3-form v3-job-create-flow" onSubmit={(event) => void submit(event)}><p className="v3-section-copy">Contexto → agenda → cobro → revisión. La lógica de guardado y validación existente se mantiene.</p><V3Field label="Cliente"><V3Select value={form.client_id} onChange={(event) => update('client_id', event.target.value)} required><option value="">Selecciona un cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{formatClientLabel(client)}</option>)}</V3Select></V3Field><V3Field label="Inmueble"><V3Select value={form.property_id} onChange={(event) => update('property_id', event.target.value)} required disabled={!form.client_id}><option value="">Selecciona un inmueble</option>{availableProperties.map((property) => <option key={property.id} value={property.id}>{formatPropertyLabel(property)}</option>)}</V3Select></V3Field><V3Field label="Presupuesto aceptado (opcional)"><V3Select value={form.quote_id} onChange={(event) => chooseQuote(event.target.value)} disabled={!form.client_id}><option value="">Servicio directo</option>{availableQuotes.map((quote) => <option key={quote.id} value={quote.id}>{formatQuoteLabel(quote)}</option>)}</V3Select></V3Field><div className="v3-form-grid"><V3Field label="Fecha"><V3Input type="date" value={form.scheduled_date} onChange={(event) => update('scheduled_date', event.target.value)} required /></V3Field><V3Field label="Estado"><V3Select value={form.status} onChange={(event) => update('status', event.target.value)}>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</V3Select></V3Field></div><V3Field label="Tipo de servicio"><V3Select value={form.service_type} onChange={(event) => update('service_type', event.target.value)}>{serviceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</V3Select></V3Field><div className="v3-form-grid"><V3Field label="Concepto"><V3Input value={lines[0]?.concept ?? ''} onChange={(event) => updateLine('concept', event.target.value)} required /></V3Field><V3Field label="Cantidad"><V3Input inputMode="decimal" value={lines[0]?.quantity ?? ''} onChange={(event) => updateLine('quantity', event.target.value)} required /></V3Field><V3Field label="Unidad"><V3Input value={lines[0]?.unit ?? 'servicio'} onChange={(event) => updateLine('unit', event.target.value)} required /></V3Field><V3Field label="Precio unitario"><V3Input inputMode="decimal" value={lines[0]?.unit_price ?? ''} onChange={(event) => updateLine('unit_price', event.target.value)} required /></V3Field></div><V3Field label="Notas"><V3Textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} /></V3Field>{message ? <p className="v3-inline-message v3-inline-message--error" role="alert">{message}</p> : null}{duplicateJobId && onOpenExistingJob ? <V3SecondaryAction type="button" onClick={() => onOpenExistingJob(duplicateJobId)}>Abrir servicio existente</V3SecondaryAction> : null}<div className="v3-workspace-actions"><V3SecondaryAction type="button" onClick={() => onCancel?.()}>Cancelar</V3SecondaryAction><V3PrimaryAction type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Crear servicio'}</V3PrimaryAction></div></form></V3BottomSheet>
}
