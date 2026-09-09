import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { formatCurrency, formatDateEs, getPropertyTypeLabel } from '../../app/displayFormat'
import { getStatusLabel } from '../../app/displayText'
import type { ClientListItem } from '../../features/clients/types'
import type { InvoiceListItem } from '../../features/invoices/types'
import type { JobListItem } from '../../features/jobs/types'
import type { PaymentListItem } from '../../features/payments/types'
import type { PropertyListItem } from '../../features/properties/types'
import type { QuoteListItem } from '../../features/quotes/types'
import type { PropertyWorkspaceTab } from '../../features/properties/usePropertyWorkspaceNavigation'
import { V3BottomSheet, V3EntityList, V3Field, V3Input, V3Page, V3PageTitle, V3PrimaryAction, V3SecondaryAction, V3Section, V3Select, V3Textarea } from '../components/V3Primitives'
import { usePropertyWorkspaceNavigation } from '../../features/properties/usePropertyWorkspaceNavigation'
import { fetchAuthenticatedSupabaseWrite, readSingleAuthenticatedWriteRow } from '../../lib/authenticatedSupabaseWrite'
import { operationalWriteRpcPaths } from '../../lib/operationalWriteRpc'
import { findPropertyDuplicateGroups } from '../../features/duplicates/duplicateEngine'
import { V3PropertyRow } from './V3PropertyRow'

interface Props { properties: PropertyListItem[]; clients: ClientListItem[]; jobs: JobListItem[]; quotes: QuoteListItem[]; invoices: InvoiceListItem[]; payments: PaymentListItem[]; error: string | null; onRefresh: () => Promise<void>; onOpenClient: (id: string) => void; onOpenClients: () => void; onOpenJob: (id: string) => void; onOpenQuote: (id: string) => void; onOpenInvoice: (id: string) => void; onCreateJob: (property: PropertyListItem) => void; onCreateQuote: (property: PropertyListItem) => void; onCreateInvoice: (property: PropertyListItem) => void }

export function V3PropertiesPage(props: Props) {
  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [edit, setEdit] = useState<PropertyListItem | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const listScrollY = useRef(0)
  const navigation = usePropertyWorkspaceNavigation(props.properties.map((item) => item.id))
  const selected = props.properties.find((item) => item.id === navigation.activePropertyId) ?? null
  const visible = useMemo(() => {
    const value = query.trim().toLocaleLowerCase()
    return props.properties.filter((property) => !value || [property.name, property.id, property.display_code, property.client_id, property.client_name, property.client_display_code, property.property_type, property.address, property.city, property.postal_code, property.notes].filter(Boolean).join(' ').toLocaleLowerCase().includes(value))
  }, [props.properties, query])
  function open(id: string, tab: PropertyWorkspaceTab = 'summary') { listScrollY.current = window.scrollY; navigation.openPropertyWorkspace(id, tab); window.requestAnimationFrame(() => window.scrollTo({ top: 0 })) }
  function close() { navigation.closePropertyWorkspace(); window.requestAnimationFrame(() => window.scrollTo({ top: listScrollY.current })) }
  async function saveEdit(value: { client_id: string; name: string; property_type: string; address: string; city: string; postal_code: string; notes: string }) {
    if (!edit) return
    setIsSaving(true)
    try {
      if (value.client_id !== edit.client_id) await fetchAuthenticatedSupabaseWrite(operationalWriteRpcPaths.reassignProperty, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_property_id: edit.id, p_client_id: value.client_id }) })
      const response = await fetchAuthenticatedSupabaseWrite(operationalWriteRpcPaths.updateProperty, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_property: { id: edit.id, name: value.name.trim(), property_type: value.property_type, address: value.address.trim(), city: value.city.trim() || null, postal_code: value.postal_code.trim() || null, notes: value.notes.trim() || null } }) })
      await readSingleAuthenticatedWriteRow(response, 'No se pudo actualizar el inmueble.')
      await props.onRefresh()
      setEdit(null)
    } finally { setIsSaving(false) }
  }
  if (selected) return <><V3PropertyWorkspace property={selected} clients={props.clients} jobs={props.jobs} quotes={props.quotes} invoices={props.invoices} payments={props.payments} activeTab={navigation.activeTab} onTabChange={navigation.setActiveTab} onBack={close} onEdit={() => setEdit(selected)} onOpenClient={props.onOpenClient} onOpenJob={props.onOpenJob} onOpenQuote={props.onOpenQuote} onOpenInvoice={props.onOpenInvoice} onCreateJob={() => props.onCreateJob(selected)} onCreateQuote={() => props.onCreateQuote(selected)} onCreateInvoice={() => props.onCreateInvoice(selected)} />{edit ? <V3BottomSheet title="Editar inmueble" onClose={() => setEdit(null)}><V3PropertyEdit property={edit} clients={props.clients} isSaving={isSaving} onClose={() => setEdit(null)} onSave={saveEdit} /></V3BottomSheet> : null}</>
  return <V3Page className="v3-properties-page">
    <V3PageTitle eyebrow="Operativa" title="Inmuebles" description="Ubicaciones reales, relaciones y siguiente acción en una lista compacta." action={<V3PrimaryAction onClick={() => setShowCreate(true)}>+ Nuevo inmueble</V3PrimaryAction>} />
    <div className="v3-properties-controls"><V3Field label="Buscar"><V3Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, código, cliente, dirección o ciudad" /></V3Field><span>{visible.length} visibles</span></div>
    {props.error ? <div className="v3-state v3-state--error" role="alert"><strong>Error cargando inmuebles</strong><p>{props.error}</p></div> : null}
    {!props.error && visible.length === 0 ? <div className="v3-state"><strong>Sin inmuebles visibles</strong><p>Ajusta la búsqueda o crea el primero.</p></div> : null}
    <V3EntityList label="Inmuebles">{visible.map((property) => <V3PropertyRow key={property.id} property={property} onOpen={() => open(property.id)} />)}</V3EntityList>
    {showCreate ? <V3BottomSheet title="Nuevo inmueble" onClose={() => setShowCreate(false)}><V3PropertyCreateForm clients={props.clients} properties={props.properties} onRefresh={props.onRefresh} onCreated={async (property) => { setShowCreate(false); open(property.id) }} onCancel={() => setShowCreate(false)} onOpenClients={props.onOpenClients} /></V3BottomSheet> : null}
    {edit ? <V3BottomSheet title="Editar inmueble" onClose={() => setEdit(null)}><V3PropertyEdit property={edit} clients={props.clients} isSaving={isSaving} onClose={() => setEdit(null)} onSave={saveEdit} /></V3BottomSheet> : null}
  </V3Page>
}

function V3PropertyCreateForm({ clients, properties, onRefresh, onCreated, onCancel, onOpenClients }: { clients: ClientListItem[]; properties: PropertyListItem[]; onRefresh: () => Promise<void>; onCreated: (property: PropertyListItem) => Promise<void>; onCancel: () => void; onOpenClients: () => void }) {
  const [value, setValue] = useState({ client_id: clients[0]?.id ?? '', name: '', property_type: 'apartment', address: '', city: '', postal_code: '', notes: '' })
  const [error, setError] = useState<string | null>(null)
  const [duplicateFound, setDuplicateFound] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const update = (key: keyof typeof value) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setValue((current) => ({ ...current, [key]: event.target.value }))
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (!value.client_id) { setError('Debes seleccionar un cliente.'); return }
    if (!value.name.trim()) { setError('Debes indicar un nombre interno para el inmueble.'); return }
    if (!value.address.trim()) { setError('Debes indicar la dirección operativa del inmueble.'); return }
    const client = clients.find((item) => item.id === value.client_id)
    const draft: PropertyListItem = { id: 'PROPERTY-DRAFT', display_code: null, client_id: value.client_id, client_display_code: client?.display_code ?? null, client_name: client?.full_name ?? null, name: value.name.trim(), status: 'active', archived_at: null, deleted_at: null, property_type: value.property_type, address: value.address.trim(), city: value.city.trim() || null, postal_code: value.postal_code.trim() || null, notes: value.notes.trim() || null }
    if (findPropertyDuplicateGroups(draft, properties).length > 0) { setDuplicateFound(true); return }
    setIsSaving(true)
    try {
      const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? `PROPERTY-${crypto.randomUUID()}` : `PROPERTY-${Date.now()}`
      const response = await fetchAuthenticatedSupabaseWrite(operationalWriteRpcPaths.createProperty, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_property: { id, client_id: value.client_id, name: value.name.trim(), property_type: value.property_type, address: value.address.trim(), city: value.city.trim() || null, postal_code: value.postal_code.trim() || null, notes: value.notes.trim() || null } }) })
      const row = await readSingleAuthenticatedWriteRow<Partial<PropertyListItem>>(response, 'El inmueble no se pudo crear. Revisa tu sesión o permisos.')
      const created: PropertyListItem = { ...draft, id: row?.id ?? id, display_code: row?.display_code ?? null, client_id: row?.client_id ?? draft.client_id, name: row?.name ?? draft.name, property_type: row?.property_type ?? draft.property_type, address: row?.address ?? draft.address, city: row?.city ?? draft.city, postal_code: row?.postal_code ?? draft.postal_code, notes: row?.notes ?? draft.notes }
      await onRefresh()
      await onCreated(created)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo crear el inmueble.') } finally { setIsSaving(false) }
  }
  if (clients.length === 0) return <div className="v3-property-create-empty"><p>Necesitas un cliente antes de crear un inmueble.</p><V3PrimaryAction onClick={onOpenClients}>Ir a Clientes V3</V3PrimaryAction></div>
  return <form className="v3-property-create-form" onSubmit={(event) => void submit(event)}><V3Field label="Cliente"><V3Select value={value.client_id} onChange={update('client_id')} required>{clients.map((client) => <option key={client.id} value={client.id}>{client.full_name}</option>)}</V3Select></V3Field><V3Field label="Nombre"><V3Input value={value.name} onChange={update('name')} required autoFocus /></V3Field><V3Field label="Tipo"><V3Select value={value.property_type} onChange={update('property_type')}><option value="apartment">Apartamento</option><option value="house">Casa</option><option value="office">Oficina</option><option value="local">Local</option><option value="tourist_apartment">Piso turístico</option><option value="community">Comunidad</option><option value="construction_site">Obra</option></V3Select></V3Field><V3Field label="Dirección"><V3Input value={value.address} onChange={update('address')} required /></V3Field><V3Field label="Ciudad"><V3Input value={value.city} onChange={update('city')} /></V3Field><V3Field label="Código postal"><V3Input value={value.postal_code} onChange={update('postal_code')} /></V3Field><V3Field label="Notas"><V3Textarea value={value.notes} onChange={update('notes')} /></V3Field>{error ? <p className="v3-inline-message v3-inline-message--error" role="alert">{error}</p> : null}{duplicateFound ? <div className="v3-state v3-state--error" role="alert"><strong>Posible inmueble duplicado</strong><p>Ya existe una coincidencia con este cliente y dirección. No se ha guardado ningún registro.</p></div> : null}<div className="v3-workspace-actions"><V3SecondaryAction onClick={onCancel}>Cancelar</V3SecondaryAction><V3PrimaryAction type="submit" disabled={isSaving || duplicateFound}>{isSaving ? 'Guardando…' : 'Crear inmueble'}</V3PrimaryAction></div></form>
}

export function V3PropertyWorkspace({ property, clients, jobs, quotes, invoices, payments, activeTab, onTabChange, onBack, onEdit, onOpenClient, onOpenJob, onOpenQuote, onOpenInvoice, onCreateJob, onCreateQuote, onCreateInvoice }: { property: PropertyListItem; clients: ClientListItem[]; jobs: JobListItem[]; quotes: QuoteListItem[]; invoices: InvoiceListItem[]; payments: PaymentListItem[]; activeTab: PropertyWorkspaceTab; onTabChange: (tab: PropertyWorkspaceTab) => void; onBack: () => void; onEdit: () => void; onOpenClient: (id: string) => void; onOpenJob: (id: string) => void; onOpenQuote: (id: string) => void; onOpenInvoice: (id: string) => void; onCreateJob: () => void; onCreateQuote: () => void; onCreateInvoice: () => void }) {
  const owner = clients.find((item) => item.id === property.client_id)
  const relatedJobs = jobs.filter((item) => item.property_id === property.id)
  const relatedQuotes = quotes.filter((item) => item.property_id === property.id)
  const relatedInvoices = invoices.filter((item) => item.property_id === property.id)
  const relatedPayments = payments.filter((item) => relatedInvoices.some((invoice) => invoice.id === item.invoice_id))
  const invoiced = relatedInvoices.reduce((sum, item) => sum + Number(item.total ?? 0), 0)
  const collected = relatedPayments.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
  const tabs: Array<[PropertyWorkspaceTab, string]> = [['summary', 'Resumen'], ['jobs', 'Servicios'], ['quotes', 'Presupuestos'], ['invoices', 'Facturas'], ['payments', 'Cobros'], ['activity', 'Actividad']]
  return <V3Page className="v3-property-workspace"><button type="button" className="v3-workspace-back" onClick={onBack}>← Inmuebles</button><V3PageTitle eyebrow={property.display_code ?? property.id} title={property.name} description={`${getPropertyTypeLabel(property.property_type)} · ${property.address}`} action={<V3SecondaryAction onClick={onEdit}>Editar</V3SecondaryAction>} /><div className="v3-filter-tabs" role="tablist" aria-label="Secciones del inmueble">{tabs.map(([tab, label]) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'is-active' : ''} onClick={() => onTabChange(tab)}>{label}</button>)}</div>
    {activeTab === 'summary' ? <><V3Section label="Cliente"><p className="v3-section-copy">{owner ? <button className="v3-inline-link" type="button" onClick={() => onOpenClient(owner.id)}>{owner.full_name}</button> : 'Cliente no disponible'}</p></V3Section><V3Section label="Resumen"><dl className="v3-facts"><div><dt>Facturado</dt><dd>{formatCurrency(invoiced)}</dd></div><div><dt>Cobrado</dt><dd>{formatCurrency(collected)}</dd></div><div><dt>Pendiente</dt><dd>{formatCurrency(Math.max(invoiced - collected, 0))}</dd></div><div><dt>Servicios</dt><dd>{relatedJobs.length}</dd></div></dl></V3Section><V3Section label="Siguiente acción"><div className="v3-workspace-actions"><V3PrimaryAction onClick={onCreateJob}>Nuevo servicio</V3PrimaryAction><V3SecondaryAction onClick={onCreateQuote}>Nuevo presupuesto</V3SecondaryAction><V3SecondaryAction onClick={onCreateInvoice}>Nueva factura</V3SecondaryAction></div></V3Section><V3Section label="Notas"><p className="v3-section-copy">{property.notes?.trim() || 'Sin notas registradas.'}</p></V3Section></> : null}
    {activeTab === 'jobs' ? <RelationSection label="Servicios" items={relatedJobs.map((item) => ({ id: item.id, title: item.display_code ?? item.id, detail: `${formatDateEs(item.scheduled_date)} · ${getStatusLabel(item.status)}`, onClick: () => onOpenJob(item.id) }))} /> : null}
    {activeTab === 'quotes' ? <RelationSection label="Presupuestos" items={relatedQuotes.map((item) => ({ id: item.id, title: item.display_code ?? item.id, detail: `${formatCurrency(item.total)} · ${getStatusLabel(item.status)}`, onClick: () => onOpenQuote(item.id) }))} /> : null}
    {activeTab === 'invoices' ? <RelationSection label="Facturas" items={relatedInvoices.map((item) => ({ id: item.id, title: item.display_code ?? item.invoice_number ?? item.id, detail: `${formatCurrency(item.total)} · ${getStatusLabel(item.status)}`, onClick: () => onOpenInvoice(item.id) }))} /> : null}
    {activeTab === 'payments' ? <RelationSection label="Cobros" items={relatedPayments.map((item) => ({ id: item.id, title: item.invoice_display_code ?? item.invoice_id, detail: `${formatCurrency(item.amount)} · ${formatDateEs(item.payment_date)}`, onClick: () => onOpenInvoice(item.invoice_id) }))} /> : null}
    {activeTab === 'activity' ? <V3Section label="Actividad"><p className="v3-section-copy">{[...relatedJobs, ...relatedQuotes, ...relatedInvoices, ...relatedPayments].length} registros relacionados en el contrato operativo.</p></V3Section> : null}
  </V3Page>
}

function RelationSection({ label, items }: { label: string; items: Array<{ id: string; title: string; detail: string; onClick: () => void }> }) { return <V3Section label={label}>{items.length ? <div className="v3-relation-list">{items.map((item) => <button key={item.id} type="button" className="v3-relation-row" onClick={item.onClick}><span><strong>{item.title}</strong><small>{item.detail}</small></span><span aria-hidden="true">→</span></button>)}</div> : <p className="v3-section-copy">Sin registros relacionados.</p>}</V3Section> }

function V3PropertyEdit({ property, clients, isSaving, onClose, onSave }: { property: PropertyListItem; clients: ClientListItem[]; isSaving: boolean; onClose: () => void; onSave: (value: { client_id: string; name: string; property_type: string; address: string; city: string; postal_code: string; notes: string }) => Promise<void> }) {
  const [value, setValue] = useState({ client_id: property.client_id, name: property.name, property_type: property.property_type, address: property.address, city: property.city ?? '', postal_code: property.postal_code ?? '', notes: property.notes ?? '' })
  const field = (key: keyof typeof value) => ({ value: value[key], onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setValue({ ...value, [key]: event.target.value }) })
  return <form className="v3-property-edit" onSubmit={(event) => { event.preventDefault(); void onSave(value) }}><V3Field label="Cliente"><V3Select {...field('client_id')}>{clients.map((client) => <option key={client.id} value={client.id}>{client.full_name}</option>)}</V3Select></V3Field><V3Field label="Nombre"><V3Input {...field('name')} required /></V3Field><V3Field label="Tipo"><V3Select {...field('property_type')}><option value="apartment">Apartamento</option><option value="house">Casa</option><option value="office">Oficina</option><option value="local">Local</option><option value="tourist_apartment">Piso turístico</option><option value="community">Comunidad</option><option value="construction_site">Obra</option></V3Select></V3Field><V3Field label="Dirección"><V3Input {...field('address')} required /></V3Field><V3Field label="Ciudad"><V3Input {...field('city')} /></V3Field><V3Field label="Código postal"><V3Input {...field('postal_code')} /></V3Field><V3Field label="Notas"><V3Textarea {...field('notes')} /></V3Field><div className="v3-workspace-actions"><V3SecondaryAction onClick={onClose}>Cancelar</V3SecondaryAction><V3PrimaryAction type="submit" disabled={isSaving}>{isSaving ? 'Guardando…' : 'Guardar cambios'}</V3PrimaryAction></div></form>
}
