import { useMemo, useRef, useState } from 'react'
import { formatCurrency, formatDateEs, getPropertyTypeLabel } from '../../app/displayFormat'
import { getStatusLabel } from '../../app/displayText'
import type { ClientListItem } from '../../features/clients/types'
import type { InvoiceListItem } from '../../features/invoices/types'
import type { JobListItem } from '../../features/jobs/types'
import type { PaymentListItem } from '../../features/payments/types'
import type { PropertyListItem } from '../../features/properties/types'
import type { QuoteListItem } from '../../features/quotes/types'
import type { PropertyWorkspaceTab } from '../../features/properties/usePropertyWorkspaceNavigation'
import { V3EntityList, V3Field, V3Icon, V3Input, V3ListWorkspace, V3Page, V3PageTitle, V3PrimaryAction, V3SecondaryAction, V3Section, V3TabStrip } from '../components/V3Primitives'
import { useV3ListWindow } from '../components/useV3ListWindow'
import { usePropertyWorkspaceNavigation } from '../../features/properties/usePropertyWorkspaceNavigation'
import { V3PropertyRow } from './V3PropertyRow'
import { getPropertyMediaForProperty } from './propertyMedia'
import { V3PropertyWriteFlow } from './V3PropertyWriteFlow'

interface Props { properties: PropertyListItem[]; clients: ClientListItem[]; jobs: JobListItem[]; quotes: QuoteListItem[]; invoices: InvoiceListItem[]; payments: PaymentListItem[]; error: string | null; onRefresh: () => Promise<void>; onOpenClient: (id: string) => void; onOpenClients: () => void; onOpenJob: (id: string) => void; onOpenQuote: (id: string) => void; onOpenInvoice: (id: string) => void; onOpenPayment: (id: string) => void; onCreateJob: (property: PropertyListItem) => void; onCreateQuote: (property: PropertyListItem) => void; onCreateInvoice: (property: PropertyListItem) => void }

export function V3PropertiesPage(props: Props) {
  const [query, setQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [edit, setEdit] = useState<PropertyListItem | null>(null)
  const listScrollY = useRef(0)
  const navigation = usePropertyWorkspaceNavigation(props.properties.map((item) => item.id))
  const selected = props.properties.find((item) => item.id === navigation.activePropertyId) ?? null
  const visible = useMemo(() => {
    const value = query.trim().toLocaleLowerCase()
    return props.properties.filter((property) => !value || [property.name, property.id, property.display_code, property.client_id, property.client_name, property.client_display_code, property.property_type, property.address, property.city, property.postal_code, property.notes].filter(Boolean).join(' ').toLocaleLowerCase().includes(value))
  }, [props.properties, query])
  const listWindow = useV3ListWindow(visible, { resetKey: query })
  function open(id: string, tab: PropertyWorkspaceTab = 'summary') { listScrollY.current = window.scrollY; navigation.openPropertyWorkspace(id, tab); window.requestAnimationFrame(() => window.scrollTo({ top: 0 })) }
  function close() { navigation.closePropertyWorkspace(); window.requestAnimationFrame(() => window.scrollTo({ top: listScrollY.current })) }
  if (selected) return <><V3PropertyWorkspace property={selected} clients={props.clients} jobs={props.jobs} quotes={props.quotes} invoices={props.invoices} payments={props.payments} activeTab={navigation.activeTab} onTabChange={navigation.setActiveTab} onBack={close} onEdit={() => setEdit(selected)} onOpenClient={props.onOpenClient} onOpenJob={props.onOpenJob} onOpenQuote={props.onOpenQuote} onOpenInvoice={props.onOpenInvoice} onOpenPayment={props.onOpenPayment} onCreateJob={() => props.onCreateJob(selected)} onCreateQuote={() => props.onCreateQuote(selected)} onCreateInvoice={() => props.onCreateInvoice(selected)} />{edit ? <V3PropertyWriteFlow mode="edit" property={edit} clients={props.clients} properties={props.properties} onRefresh={props.onRefresh} onCompleted={async () => setEdit(null)} onCancel={() => setEdit(null)} /> : null}</>
  return <V3Page className="v3-properties-page">
    <V3PageTitle eyebrow="Operativa" title="Inmuebles" description="Ubicaciones reales, relaciones y siguiente acción en una lista compacta." action={<V3PrimaryAction onClick={() => setShowCreate(true)}>+ Nuevo inmueble</V3PrimaryAction>} />
    <div className="v3-properties-controls"><V3Field label="Buscar"><V3Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, código, cliente, dirección o ciudad" /></V3Field><span>{visible.length} visibles</span></div>
    <V3ListWorkspace label="Inmuebles" {...listWindow} onPageChange={listWindow.setPage}>
      {props.error ? <div className="v3-state v3-state--error" role="alert"><strong>Error cargando inmuebles</strong><p>{props.error}</p></div> : null}
      {!props.error && visible.length === 0 ? <div className="v3-state"><strong>Sin inmuebles visibles</strong><p>Ajusta la búsqueda o crea el primero.</p></div> : null}
      <V3EntityList label="Inmuebles">{listWindow.pageItems.map((property) => <V3PropertyRow key={property.id} property={property} onOpen={() => open(property.id)} />)}</V3EntityList>
    </V3ListWorkspace>
    {showCreate ? <V3PropertyWriteFlow mode="create" clients={props.clients} properties={props.properties} onRefresh={props.onRefresh} onCompleted={async (property) => { setShowCreate(false); if (property) open(property.id) }} onCancel={() => setShowCreate(false)} onOpenClients={props.onOpenClients} /> : null}
    {edit ? <V3PropertyWriteFlow mode="edit" property={edit} clients={props.clients} properties={props.properties} onRefresh={props.onRefresh} onCompleted={async () => { setEdit(null) }} onCancel={() => setEdit(null)} /> : null}
  </V3Page>
}

export function V3PropertyWorkspace({ property, clients, jobs, quotes, invoices, payments, activeTab, onTabChange, onBack, onEdit, onOpenClient, onOpenJob, onOpenQuote, onOpenInvoice, onOpenPayment, onCreateJob, onCreateQuote, onCreateInvoice }: { property: PropertyListItem; clients: ClientListItem[]; jobs: JobListItem[]; quotes: QuoteListItem[]; invoices: InvoiceListItem[]; payments: PaymentListItem[]; activeTab: PropertyWorkspaceTab; onTabChange: (tab: PropertyWorkspaceTab) => void; onBack: () => void; onEdit: () => void; onOpenClient: (id: string) => void; onOpenJob: (id: string) => void; onOpenQuote: (id: string) => void; onOpenInvoice: (id: string) => void; onOpenPayment: (id: string) => void; onCreateJob: () => void; onCreateQuote: () => void; onCreateInvoice: () => void }) {
  const owner = clients.find((item) => item.id === property.client_id)
  const media = getPropertyMediaForProperty(property)
  const relatedJobs = jobs.filter((item) => item.property_id === property.id)
  const relatedQuotes = quotes.filter((item) => item.property_id === property.id)
  const relatedInvoices = invoices.filter((item) => item.property_id === property.id)
  const relatedPayments = payments.filter((item) => relatedInvoices.some((invoice) => invoice.id === item.invoice_id))
  const invoiced = relatedInvoices.reduce((sum, item) => sum + Number(item.total ?? 0), 0)
  const collected = relatedPayments.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
  const tabs: Array<[PropertyWorkspaceTab, string]> = [['summary', 'Resumen'], ['jobs', 'Servicios'], ['quotes', 'Presupuestos'], ['invoices', 'Facturas'], ['payments', 'Cobros'], ['activity', 'Actividad']]
  return <V3Page className="v3-property-workspace"><button type="button" className="v3-workspace-back" onClick={onBack}><V3Icon name="back" /> Inmuebles</button><V3PageTitle eyebrow={property.display_code ?? 'Sin código'} title={property.name} description={`${getPropertyTypeLabel(property.property_type)} · ${property.address}`} action={<V3SecondaryAction onClick={onEdit}>Editar</V3SecondaryAction>} /><img className="v3-property-workspace__media" src={media.src} alt={media.alt} /><V3TabStrip label="Secciones del inmueble" activeValue={activeTab} onChange={(value) => onTabChange(value as PropertyWorkspaceTab)} options={tabs.map(([value, label]) => ({ value, label }))} />
    {activeTab === 'summary' ? <><V3Section label="Cliente"><p className="v3-section-copy">{owner ? <button className="v3-inline-link" type="button" onClick={() => onOpenClient(owner.id)}>{owner.full_name}</button> : 'Cliente no disponible'}</p></V3Section><V3Section label="Resumen"><dl className="v3-facts"><div><dt>Facturado</dt><dd>{formatCurrency(invoiced)}</dd></div><div><dt>Cobrado</dt><dd>{formatCurrency(collected)}</dd></div><div><dt>Pendiente</dt><dd>{formatCurrency(Math.max(invoiced - collected, 0))}</dd></div><div><dt>Servicios</dt><dd>{relatedJobs.length}</dd></div></dl></V3Section><V3Section label="Siguiente acción"><div className="v3-workspace-actions"><V3PrimaryAction onClick={onCreateJob}>Nuevo servicio</V3PrimaryAction><V3SecondaryAction onClick={onCreateQuote}>Nuevo presupuesto</V3SecondaryAction><V3SecondaryAction onClick={onCreateInvoice}>Nueva factura</V3SecondaryAction></div></V3Section><V3Section label="Notas"><p className="v3-section-copy">{property.notes?.trim() || 'Sin notas registradas.'}</p></V3Section></> : null}
    {activeTab === 'jobs' ? <RelationSection label="Servicios" items={relatedJobs.map((item) => ({ id: item.id, title: item.display_code ?? 'Servicio', detail: `${formatDateEs(item.scheduled_date)} · ${getStatusLabel(item.status)}`, onClick: () => onOpenJob(item.id) }))} /> : null}
    {activeTab === 'quotes' ? <RelationSection label="Presupuestos" items={relatedQuotes.map((item) => ({ id: item.id, title: item.display_code ?? 'Presupuesto', detail: `${formatCurrency(item.total)} · ${getStatusLabel(item.status)}`, onClick: () => onOpenQuote(item.id) }))} /> : null}
    {activeTab === 'invoices' ? <RelationSection label="Facturas" items={relatedInvoices.map((item) => ({ id: item.id, title: item.display_code ?? item.invoice_number ?? 'Factura', detail: `${formatCurrency(item.total)} · ${getStatusLabel(item.status)}`, onClick: () => onOpenInvoice(item.id) }))} /> : null}
    {activeTab === 'payments' ? <RelationSection label="Cobros" items={relatedPayments.map((item) => ({ id: item.id, title: item.invoice_display_code ?? 'Cobro', detail: `${formatCurrency(item.amount)} · ${formatDateEs(item.payment_date)}`, onClick: () => onOpenPayment(item.id) }))} /> : null}
    {activeTab === 'activity' ? <V3Section label="Actividad"><p className="v3-section-copy">{[...relatedJobs, ...relatedQuotes, ...relatedInvoices, ...relatedPayments].length} registros relacionados en el contrato operativo.</p></V3Section> : null}
  </V3Page>
}

function RelationSection({ label, items }: { label: string; items: Array<{ id: string; title: string; detail: string; onClick: () => void }> }) { return <V3Section label={label}>{items.length ? <div className="v3-relation-list">{items.map((item) => <button key={item.id} type="button" className="v3-relation-row" onClick={item.onClick}><span><strong>{item.title}</strong><small>{item.detail}</small></span><V3Icon name="forward" size={16} /></button>)}</div> : <p className="v3-section-copy">Sin registros relacionados.</p>}</V3Section> }
