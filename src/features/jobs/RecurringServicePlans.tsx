import { useEffect, useState } from 'react'
import { ActionFlowOverlay } from '../../components/ActionFlowOverlay'
import { FullscreenStepFlow } from '../../components/FullscreenStepFlow'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import { formatRecurringSchedule, getRecurringOccurrenceDates } from './recurringServiceSchedule'
import { generateRecurringServiceOccurrences, listRecurringServicePlans, saveRecurringServicePlan, setRecurringServicePlanStatus, type RecurringServicePlan } from './recurringServiceApi'

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
}

function newPlanDraft(): PlanDraft {
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
  }
}

function PlanFlow({ clients, properties, onSaved, onCancel }: RecurringServicePlanFlowProps) {
  const [draft, setDraft] = useState(newPlanDraft)
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
      title="Crear recurrencia"
      description="Planifica visitas futuras y genera solo el horizonte que confirmes explícitamente."
      steps={steps}
      currentStep={currentStep}
      onStepSelect={(step) => { if (step <= currentStep) setCurrentStep(step) }}
      contextItems={[{ label: 'Vista previa', value: `${preview.length} próxima(s)` }, { label: 'Facturación', value: 'Solo plantilla de servicio' }]}
      footerContent={(
        <div className="page-header-actions">
          <button type="button" className="secondary-button" onClick={onCancel} disabled={saving}>Cancelar</button>
          {currentStep > 0 ? <button type="button" className="secondary-button" onClick={() => setCurrentStep((step) => step - 1)} disabled={saving}>Atrás</button> : null}
          {currentStep < steps.length - 1 ? <button type="button" className="primary-button" onClick={() => { const invalid = validate(currentStep); if (invalid) setError(invalid); else setCurrentStep((step) => step + 1) }} disabled={saving}>Continuar</button> : <button type="button" className="primary-button" onClick={() => void save()} disabled={saving}>{saving ? 'Guardando plan...' : 'Guardar plan'}</button>}
        </div>
      )}
    >
      {currentStep === 0 ? <div className="lead-form cc-form-shell__grid"><label>Título<input value={draft.title} onChange={(event) => update('title', event.target.value)} placeholder="Limpieza semanal Villa Mar" /></label><label>Cliente<select value={draft.client_id} onChange={(event) => { update('client_id', event.target.value); update('property_id', '') }}><option value="">Selecciona cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.full_name}</option>)}</select></label><label>Propiedad<select value={draft.property_id} onChange={(event) => update('property_id', event.target.value)} disabled={!draft.client_id}><option value="">Selecciona propiedad</option>{filteredProperties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label></div> : null}
      {currentStep === 1 ? <div className="lead-form cc-form-shell__grid"><label>Frecuencia<select value={draft.schedule_kind} onChange={(event) => update('schedule_kind', event.target.value as PlanDraft['schedule_kind'])}><option value="weekly">Semanal</option><option value="biweekly">Quincenal</option><option value="monthly">Mensual</option></select></label><label>Inicio<input type="date" value={draft.start_date} onChange={(event) => update('start_date', event.target.value)} /></label><label>Fin opcional<input type="date" value={draft.end_date} onChange={(event) => update('end_date', event.target.value)} /></label>{draft.schedule_kind === 'monthly' ? <label>Día del mes (1-28)<input type="number" min="1" max="28" value={draft.monthly_day} onChange={(event) => update('monthly_day', Number(event.target.value))} /></label> : <fieldset><legend>Días</legend><div className="page-header-actions">{weekdayShortLabels.map((label, index) => { const day = index + 1; const selected = draft.weekdays.includes(day); return <button key={day} type="button" className={selected ? 'primary-button' : 'secondary-button'} aria-label={weekdayLabels[index]} aria-pressed={selected} onClick={() => update('weekdays', selected ? draft.weekdays.filter((value) => value !== day) : [...draft.weekdays, day].sort())}>{label}</button> })}</div></fieldset>}</div> : null}
      {currentStep === 2 ? <div className="lead-form cc-form-shell__grid"><label>Tipo de servicio<input value={draft.service_type} onChange={(event) => update('service_type', event.target.value)} /></label><label>Concepto<input value={draft.concept} onChange={(event) => update('concept', event.target.value)} placeholder="Limpieza general" /></label><label>Cantidad<input type="number" min="0.01" step="0.01" value={draft.quantity} onChange={(event) => update('quantity', Number(event.target.value))} /></label><label>Precio unitario<input type="number" min="0" step="0.01" value={draft.unit_price} onChange={(event) => update('unit_price', Number(event.target.value))} /></label><label>Notas<textarea value={draft.notes} onChange={(event) => update('notes', event.target.value)} /></label></div> : null}
      {currentStep === 3 ? <div className="data-section"><h3>Próximas visitas</h3><p>{formatRecurringSchedule(previewPlan)}</p><ul>{preview.map((date) => <li key={date}>{new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`))}</li>)}</ul><p>Plantilla: {draft.concept} · {subtotal.toFixed(2)} € por visita.</p></div> : null}
      {error ? <p role="alert" className="form-error">{error}</p> : null}
    </FullscreenStepFlow>
  )
}

interface RecurringServicePlansProps { clients: ClientListItem[]; properties: PropertyListItem[]; onJobsChanged: () => Promise<void> }

export function RecurringServicePlans({ clients, properties, onJobsChanged }: RecurringServicePlansProps) {
  const [plans, setPlans] = useState<RecurringServicePlan[]>([])
  const [showFlow, setShowFlow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState<string | null>(null)
  const [generationHorizon, setGenerationHorizon] = useState(30)

  async function refresh() { try { setPlans(await listRecurringServicePlans()); setError(null) } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'La recurrencia aún no está disponible en este entorno.') } }
  useEffect(() => { void refresh() }, [])

  async function generate(plan: RecurringServicePlan, days: number) {
    setGenerating(plan.id)
    try { const result = await generateRecurringServiceOccurrences(plan.id, new Date().toISOString().slice(0, 10), new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)); setError(`${result.created_count} visita(s) creadas; ${result.existing_count} ya existían.`); await onJobsChanged(); await refresh() } catch (generationError) { setError(generationError instanceof Error ? generationError.message : 'No se pudieron generar las visitas.') } finally { setGenerating(null) }
  }

  return <>
    <section className="cc-recurring-service-readiness" data-qa="recurring-service-section"><div className="cc-recurring-service-readiness__copy"><span>Servicios recurrentes</span><strong>Planifica y genera visitas bajo confirmación</strong><p>Los planes no crean trabajos automáticamente. Revisa la previsión y genera un horizonte acotado cuando lo decidas.</p></div><button type="button" className="primary-button" data-qa="recurring-service-create-action" onClick={() => setShowFlow(true)}>Crear recurrencia</button></section>
    {error ? <p role="status" className="form-error">{error}</p> : null}
    {plans.length > 0 ? <section className="data-section"><div className="cc-list-section__header"><div><h3>Planes recurrentes</h3><p>Genera visitas solo dentro del horizonte confirmado.</p></div><label>Horizonte<select value={generationHorizon} onChange={(event) => setGenerationHorizon(Number(event.target.value))}><option value="30">30 días</option><option value="60">60 días</option><option value="90">90 días</option></select></label></div>{plans.map((plan) => <article key={plan.id} className="cc-list-section__header"><div><strong>{plan.title}</strong><p>{formatRecurringSchedule(plan)} · {plan.status}</p></div><div className="page-header-actions"><button type="button" className="secondary-button" disabled={generating === plan.id} onClick={() => void setRecurringServicePlanStatus(plan.id, plan.status === 'active' ? 'paused' : 'active').then(refresh).catch((statusError) => setError(statusError instanceof Error ? statusError.message : 'No se pudo actualizar el plan.'))}>{plan.status === 'active' ? 'Pausar' : 'Reactivar'}</button>{plan.status === 'active' ? <button type="button" className="primary-button" disabled={generating === plan.id} onClick={() => void generate(plan, generationHorizon)}>Generar visitas</button> : null}</div></article>)}</section> : null}
    {showFlow ? <ActionFlowOverlay isOpen title="Crear recurrencia" description="Guarda el plan y vuelve al listado de servicios." onClose={() => setShowFlow(false)}><PlanFlow clients={clients} properties={properties} onSaved={async () => { setShowFlow(false); await refresh() }} onCancel={() => setShowFlow(false)} /></ActionFlowOverlay> : null}
  </>
}
