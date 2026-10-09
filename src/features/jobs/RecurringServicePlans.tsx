import { useEffect, useState } from 'react'
import { ActionFlowOverlay } from '../../components/ActionFlowOverlay'
import { FullscreenStepFlow } from '../../components/FullscreenStepFlow'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import { formatRecurringSchedule, getRecurringOccurrenceDates } from './recurringServiceSchedule'
import { generateRecurringServiceOccurrences, listRecurringServiceOccurrences, listRecurringServicePlanSlots, listRecurringServicePlans, saveRecurringServicePlan, saveRecurringServicePlanSchedule, setRecurringServiceOccurrence, setRecurringServicePlanStatus, type RecurringServiceOccurrence, type RecurringServicePlan, type RecurringServiceSlot } from './recurringServiceApi'

const weekdayLabels = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const weekdayShortLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const steps = [
  { id: 'relationship', label: 'Cliente y propiedad', description: 'Selecciona el contexto del servicio.' },
  { id: 'frequency', label: 'Frecuencia', description: 'Define el patrón acotado.' },
  { id: 'service', label: 'Servicio', description: 'Define la plantilla de cada visita.' },
  { id: 'review', label: 'Revisar', description: 'Previsualiza y guarda el plan.' },
]

interface RecurringServicePlanFlowProps {
  clients: ClientListItem[]
  properties: PropertyListItem[]
  onSaved: () => Promise<void>
  onCancel: () => void
  initialPlan?: RecurringServicePlan | null
  initialSlots?: RecurringServiceSlot[]
}

interface PlanDraft {
  id: string
  client_id: string
  property_id: string
  title: string
  service_type: string
  schedule_kind: 'weekly' | 'biweekly' | 'monthly'
  weekdays: number[]
  monthly_day: number
  start_date: string
  end_date: string
  concept: string
  quantity: number
  unit_price: number
  notes: string
  slots: RecurringServiceSlot[]
}

function newPlanDraft(initialPlan?: RecurringServicePlan | null, initialSlots: RecurringServiceSlot[] = []): PlanDraft {
  if (initialPlan) {
    return {
      id: initialPlan.id,
      client_id: initialPlan.client_id,
      property_id: initialPlan.property_id,
      title: initialPlan.title,
      service_type: initialPlan.service_type,
      schedule_kind: initialPlan.schedule_kind,
      weekdays: initialPlan.weekdays ?? [],
      monthly_day: initialPlan.monthly_day ?? 1,
      start_date: initialPlan.start_date,
      end_date: initialPlan.end_date ?? '',
      concept: initialPlan.billing_concept ?? '',
      quantity: initialPlan.billing_quantity ?? 1,
      unit_price: initialPlan.billing_unit_price ?? 0,
      notes: initialPlan.notes ?? '',
      slots: initialSlots.length > 0 ? initialSlots : [{ weekday: (initialPlan.weekdays ?? [1])[0], start_time: initialPlan.default_start_time, duration_minutes: initialPlan.default_duration_minutes ?? 180, workers_required: initialPlan.default_workers_required ?? 1 }],
    }
  }
  const id = crypto.randomUUID()
  return {
    id: `RSP-${id}`,
    client_id: '',
    property_id: '',
    title: '',
    service_type: 'standard_cleaning',
    schedule_kind: 'weekly',
    weekdays: [1],
    monthly_day: 1,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '',
    concept: '',
    quantity: 1,
    unit_price: 0,
    notes: '',
    slots: [{ weekday: 1, start_time: null, duration_minutes: 180, workers_required: 1 }],
  }
}

function PlanFlow({ clients, properties, onSaved, onCancel, initialPlan = null, initialSlots = [] }: RecurringServicePlanFlowProps) {
  const [draft, setDraft] = useState(() => newPlanDraft(initialPlan, initialSlots))
  const [currentStep, setCurrentStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const filteredProperties = properties.filter((property) => property.client_id === draft.client_id)
  const previewPlan = { schedule_kind: draft.schedule_kind, weekdays: draft.weekdays, monthly_day: draft.monthly_day, start_date: draft.start_date, end_date: draft.end_date || null }
  const preview = getRecurringOccurrenceDates(previewPlan, draft.start_date, draft.end_date || new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10)).slice(0, 8)
  const subtotal = Math.round(draft.quantity * draft.unit_price * 100) / 100

  function update<K extends keyof PlanDraft>(key: K, value: PlanDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setError(null)
  }

  function validate(step: number): string | null {
    if (step === 0 && (!draft.client_id || !draft.property_id || !draft.title.trim())) return 'Completa título, cliente y propiedad.'
    if (step === 1 && ((draft.schedule_kind !== 'monthly' && draft.weekdays.length === 0) || (draft.schedule_kind === 'monthly' && (draft.monthly_day < 1 || draft.monthly_day > 28)))) return 'Completa una frecuencia válida.'
    if (step === 2 && (!draft.concept.trim() || draft.quantity <= 0 || draft.unit_price < 0)) return 'Completa una plantilla de servicio válida.'
    return null
  }

  async function save() {
    const invalid = [0, 1, 2].map(validate).find(Boolean)
    if (invalid) { setError(invalid); return }
    setSaving(true)
    try {
      await saveRecurringServicePlan({
        id: draft.id,
        client_id: draft.client_id,
        property_id: draft.property_id,
        title: draft.title.trim(),
        service_type: draft.service_type,
        status: 'active',
        schedule_kind: draft.schedule_kind,
        weekdays: draft.schedule_kind === 'monthly' ? null : draft.weekdays,
        monthly_day: draft.schedule_kind === 'monthly' ? draft.monthly_day : null,
        start_date: draft.start_date,
        end_date: draft.end_date || null,
        billing_concept: draft.concept.trim(),
        billing_quantity: draft.quantity,
        billing_unit: 'servicio',
        billing_unit_price: draft.unit_price,
        template_lines: [{ sort_order: 1, concept: draft.concept.trim(), quantity: draft.quantity, unit: 'servicio', unit_price: draft.unit_price, line_subtotal: subtotal }],
        notes: draft.notes.trim() || null,
      })
      await saveRecurringServicePlanSchedule(draft.id, draft.slots)
      await onSaved()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el plan. El borrador se conserva.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <FullscreenStepFlow
      eyebrow="Servicios recurrentes"
      title={initialPlan ? 'Editar recurrencia' : 'Crear recurrencia'}
      description="Planifica visitas futuras y genera solo el horizonte que confirmes explícitamente."
      steps={steps}
      currentStep={currentStep}
      onStepSelect={(step) => { if (step <= currentStep) setCurrentStep(step) }}
      contextItems={[{ label: 'Vista previa', value: `${preview.length} próxima(s)` }, { label: 'Facturación', value: 'Solo plantilla de servicio' }]}
      footerContent={(
        <div className="page-header-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={saving}>Cancelar</button>
          {currentStep > 0 ? <button type="button" className="secondary-button" onClick={() => setCurrentStep((step) => step - 1)} disabled={saving}>Atrás</button> : null}
          {currentStep < steps.length - 1 ? <button type="button" className="primary-button" onClick={() => { const invalid = validate(currentStep); if (invalid) setError(invalid); else setCurrentStep((step) => step + 1) }} disabled={saving}>Continuar</button> : <button type="button" className="primary-button" onClick={() => void save()} disabled={saving}>{saving ? 'Guardando plan...' : initialPlan ? 'Guardar cambios' : 'Guardar plan'}</button>}
        </div>
      )}
    >
      {currentStep === 0 ? <div className="lead-form cc-form-shell__grid"><label>Título<input value={draft.title} onChange={(event) => update('title', event.target.value)} placeholder="Limpieza semanal Villa Mar" /></label><label>Cliente<select value={draft.client_id} onChange={(event) => { update('client_id', event.target.value); update('property_id', '') }}><option value="">Selecciona cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.full_name}</option>)}</select></label><label>Propiedad<select value={draft.property_id} onChange={(event) => update('property_id', event.target.value)} disabled={!draft.client_id}><option value="">Selecciona propiedad</option>{filteredProperties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label></div> : null}
      {currentStep === 1 ? <div className="lead-form cc-form-shell__grid"><label>Frecuencia<select value={draft.schedule_kind} onChange={(event) => update('schedule_kind', event.target.value as PlanDraft['schedule_kind'])}><option value="weekly">Semanal</option><option value="biweekly">Quincenal</option><option value="monthly">Mensual</option></select></label><label>Inicio<input type="date" value={draft.start_date} onChange={(event) => update('start_date', event.target.value)} /></label><label>Fin opcional<input type="date" value={draft.end_date} onChange={(event) => update('end_date', event.target.value)} /></label>{draft.schedule_kind === 'monthly' ? <label>Día del mes (1-28)<input type="number" min="1" max="28" value={draft.monthly_day} onChange={(event) => update('monthly_day', Number(event.target.value))} /></label> : <fieldset><legend>Días</legend><div className="page-header-actions">{weekdayShortLabels.map((label, index) => { const day = index + 1; const selected = draft.weekdays.includes(day); return <button key={day} type="button" className={selected ? 'primary-button' : 'secondary-button'} aria-label={weekdayLabels[index]} aria-pressed={selected} onClick={() => { const nextDays = selected ? draft.weekdays.filter((value) => value !== day) : [...draft.weekdays, day].sort(); update('weekdays', nextDays); if (!selected && !draft.slots.some((slot) => slot.weekday === day)) update('slots', [...draft.slots, { weekday: day, start_time: null, duration_minutes: day >= 6 ? 120 : 180, workers_required: 1 }]) }}>{label}</button> })}</div></fieldset>}</div> : null}
      {currentStep === 2 ? <div className="lead-form cc-form-shell__grid"><label>Tipo de servicio<input value={draft.service_type} onChange={(event) => update('service_type', event.target.value)} /></label><label>Concepto<input value={draft.concept} onChange={(event) => update('concept', event.target.value)} placeholder="Limpieza general" /></label><label>Cantidad<input type="number" min="0.01" step="0.01" value={draft.quantity} onChange={(event) => update('quantity', Number(event.target.value))} /></label><label>Precio unitario<input type="number" min="0" step="0.01" value={draft.unit_price} onChange={(event) => update('unit_price', Number(event.target.value))} /></label>{draft.slots.filter((slot) => draft.weekdays.includes(slot.weekday)).map((slot) => <fieldset key={slot.weekday}><legend>{weekdayLabels[slot.weekday - 1]}</legend><label>Hora opcional<input type="time" value={slot.start_time ?? ''} onChange={(event) => update('slots', draft.slots.map((item) => item.weekday === slot.weekday ? { ...item, start_time: event.target.value || null } : item))} /></label><label>Duración (minutos)<input type="number" min="15" max="1440" step="15" value={slot.duration_minutes} onChange={(event) => update('slots', draft.slots.map((item) => item.weekday === slot.weekday ? { ...item, duration_minutes: Number(event.target.value) } : item))} /></label><label>Personal previsto<input type="number" min="1" max="100" value={slot.workers_required} onChange={(event) => update('slots', draft.slots.map((item) => item.weekday === slot.weekday ? { ...item, workers_required: Number(event.target.value) } : item))} /></label></fieldset>)}<label>Notas<textarea value={draft.notes} onChange={(event) => update('notes', event.target.value)} /></label></div> : null}
      {currentStep === 3 ? <div className="data-section"><h3>Próximas visitas</h3><p>{formatRecurringSchedule(previewPlan)}</p><ul>{preview.map((date) => <li key={date}>{new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`))}</li>)}</ul><p>Plantilla: {draft.concept} · {subtotal.toFixed(2)} € por visita.</p></div> : null}
      {error ? <p role="alert" className="form-error">{error}</p> : null}
    </FullscreenStepFlow>
  )
}

interface RecurringServicePlansProps { clients: ClientListItem[]; properties: PropertyListItem[]; onJobsChanged: () => Promise<void> }

export function RecurringServicePlans({ clients, properties, onJobsChanged }: RecurringServicePlansProps) {
  const [plans, setPlans] = useState<RecurringServicePlan[]>([])
  const [occurrences, setOccurrences] = useState<RecurringServiceOccurrence[]>([])
  const [showFlow, setShowFlow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState<string | null>(null)
  const [generationHorizon, setGenerationHorizon] = useState(30)
  const [editingPlan, setEditingPlan] = useState<RecurringServicePlan | null>(null)
  const [editingSlots, setEditingSlots] = useState<RecurringServiceSlot[]>([])
  const [editingOccurrenceKey, setEditingOccurrenceKey] = useState<string | null>(null)
  const [occurrenceDraft, setOccurrenceDraft] = useState({ start_time: '', duration_minutes: 180, workers_required: 1 })
  const [loadingEdit, setLoadingEdit] = useState<string | null>(null)

  async function refresh() { try { const today = new Date(); const through = new Date(today.getTime() + 90 * 86_400_000); const [nextPlans, nextOccurrences] = await Promise.all([listRecurringServicePlans(), listRecurringServiceOccurrences(today.toISOString().slice(0, 10), through.toISOString().slice(0, 10))]); setPlans(nextPlans); setOccurrences(nextOccurrences); setError(null) } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'La recurrencia aún no está disponible en este entorno.') } }
  useEffect(() => { void refresh() }, [])

  async function generate(plan: RecurringServicePlan, days: number) {
    setGenerating(plan.id)
    try { const result = await generateRecurringServiceOccurrences(plan.id, new Date().toISOString().slice(0, 10), new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)); setError(`${result.created_count} visita(s) creadas; ${result.existing_count} ya existían.`); await onJobsChanged(); await refresh() } catch (generationError) { setError(generationError instanceof Error ? generationError.message : 'No se pudieron generar las visitas.') } finally { setGenerating(null) }
  }

  async function openEdit(plan: RecurringServicePlan) {
    setLoadingEdit(plan.id)
    try {
      setEditingSlots(await listRecurringServicePlanSlots(plan.id))
      setEditingPlan(plan)
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la serie.')
    } finally {
      setLoadingEdit(null)
    }
  }

  function beginOccurrenceEdit(occurrence: RecurringServiceOccurrence) {
    setEditingOccurrenceKey(`${occurrence.recurring_service_plan_id}-${occurrence.occurrence_date}`)
    setOccurrenceDraft({ start_time: occurrence.start_time?.slice(0, 5) ?? '', duration_minutes: occurrence.duration_minutes, workers_required: occurrence.workers_required })
  }

  async function saveOccurrence(occurrence: RecurringServiceOccurrence) {
    try {
      await setRecurringServiceOccurrence(occurrence.recurring_service_plan_id, occurrence.occurrence_date, 'planned', occurrenceDraft)
      setEditingOccurrenceKey(null)
      await refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo actualizar la visita.')
    }
  }

  async function toggleOccurrence(occurrence: RecurringServiceOccurrence) {
    try {
      await setRecurringServiceOccurrence(occurrence.recurring_service_plan_id, occurrence.occurrence_date, occurrence.status === 'skipped' ? 'planned' : 'skipped')
      await refresh()
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'No se pudo actualizar el estado de la visita.')
    }
  }

  return <>
    <section className="cc-recurring-service-readiness" data-qa="recurring-service-section"><div className="cc-recurring-service-readiness__copy"><span>Servicios recurrentes</span><strong>Planifica y genera visitas bajo confirmación</strong><p>Los planes no crean trabajos automáticamente. Revisa la previsión y genera un horizonte acotado cuando lo decidas.</p></div><button type="button" className="primary-button" data-qa="recurring-service-create-action" onClick={() => setShowFlow(true)}>Crear recurrencia</button></section>
    {error ? <p role="status" className="form-error">{error}</p> : null}
    {plans.length > 0 ? <section className="data-section"><div className="cc-list-section__header"><div><h3>Planes recurrentes</h3><p>Genera visitas solo dentro del horizonte confirmado.</p></div><label>Horizonte<select value={generationHorizon} onChange={(event) => setGenerationHorizon(Number(event.target.value))}><option value="30">30 días</option><option value="60">60 días</option><option value="90">90 días</option></select></label></div>{plans.map((plan) => <article key={plan.id} className="cc-list-section__header"><div><strong>{plan.title}</strong><p>{formatRecurringSchedule(plan)} · {plan.status}</p></div><div className="page-header-actions"><button type="button" className="secondary-button" disabled={generating === plan.id || loadingEdit === plan.id} onClick={() => void openEdit(plan)}>{loadingEdit === plan.id ? 'Cargando...' : 'Editar serie'}</button><button type="button" className="secondary-button" disabled={generating === plan.id} onClick={() => void setRecurringServicePlanStatus(plan.id, plan.status === 'active' ? 'paused' : 'active').then(refresh).catch((statusError) => setError(statusError instanceof Error ? statusError.message : 'No se pudo actualizar el plan.'))}>{plan.status === 'active' ? 'Pausar' : 'Reactivar'}</button>{plan.status === 'active' ? <button type="button" className="primary-button" disabled={generating === plan.id} onClick={() => void generate(plan, generationHorizon)}>Generar visitas</button> : null}</div></article>)}</section> : null}
    {occurrences.length > 0 ? <section className="data-section" aria-label="Próximos servicios recurrentes"><div className="cc-list-section__header"><div><h3>Próximos servicios</h3><p>Visitas generadas dentro del horizonte confirmado.</p></div></div>{occurrences.map((occurrence) => { const plan = plans.find((item) => item.id === occurrence.recurring_service_plan_id); const client = clients.find((item) => item.id === plan?.client_id); const property = properties.find((item) => item.id === plan?.property_id); const occurrenceKey = `${occurrence.recurring_service_plan_id}-${occurrence.occurrence_date}`; const editing = editingOccurrenceKey === occurrenceKey; return <article key={occurrenceKey} className="cc-list-section__header"><div><strong>{occurrence.occurrence_date} · {plan?.title ?? 'Servicio recurrente'}</strong><p>{client?.full_name ?? 'Cliente'} · {property?.name ?? 'Inmueble'} · {occurrence.duration_minutes} min · {occurrence.workers_required} persona(s)</p>{editing ? <div className="page-header-actions"><label>Hora<input type="time" value={occurrenceDraft.start_time} onChange={(event) => setOccurrenceDraft((current) => ({ ...current, start_time: event.target.value }))} /></label><label>Duración<input type="number" min="15" max="1440" step="15" value={occurrenceDraft.duration_minutes} onChange={(event) => setOccurrenceDraft((current) => ({ ...current, duration_minutes: Number(event.target.value) }))} /></label><label>Personal<input type="number" min="1" max="100" value={occurrenceDraft.workers_required} onChange={(event) => setOccurrenceDraft((current) => ({ ...current, workers_required: Number(event.target.value) }))} /></label><button type="button" className="primary-button" onClick={() => void saveOccurrence(occurrence)}>Guardar</button><button type="button" className="secondary-button" onClick={() => setEditingOccurrenceKey(null)}>Cancelar</button></div> : null}</div><div className="page-header-actions"><span>{occurrence.status === 'skipped' ? 'Omitido' : occurrence.start_time ? occurrence.start_time.slice(0, 5) : 'Hora por definir'}</span>{!editing ? <><button type="button" className="secondary-button" onClick={() => beginOccurrenceEdit(occurrence)}>Editar</button><button type="button" className="secondary-button" onClick={() => void toggleOccurrence(occurrence)}>{occurrence.status === 'skipped' ? 'Reactivar' : 'Omitir'}</button></> : null}</div></article> })}</section> : null}
    {showFlow ? <ActionFlowOverlay isOpen title="Crear recurrencia" description="Guarda el plan y vuelve al listado de servicios." onClose={() => setShowFlow(false)}><PlanFlow clients={clients} properties={properties} onSaved={async () => { setShowFlow(false); await refresh() }} onCancel={() => setShowFlow(false)} /></ActionFlowOverlay> : null}
    {editingPlan ? <ActionFlowOverlay isOpen title="Editar recurrencia" description="Actualiza la serie futura sin modificar visitas ya ejecutadas." onClose={() => setEditingPlan(null)}><PlanFlow clients={clients} properties={properties} initialPlan={editingPlan} initialSlots={editingSlots} onSaved={async () => { setEditingPlan(null); await refresh() }} onCancel={() => setEditingPlan(null)} /></ActionFlowOverlay> : null}
  </>
}
