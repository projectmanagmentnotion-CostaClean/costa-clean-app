import { useMemo, useRef, useState } from 'react'
import { formatCurrency, formatDateEs } from '../../app/displayFormat'
import type { ClientListItem } from '../../features/clients/types'
import type { InvoiceListItem } from '../../features/invoices/types'
import type { JobListItem } from '../../features/jobs/types'
import type { PaymentListItem } from '../../features/payments/types'
import type { PropertyListItem } from '../../features/properties/types'
import type { QuoteListItem } from '../../features/quotes/types'
import type { RecurringInvoicePlanListItem } from '../../features/recurringInvoices/types'
import { V3BottomSheet, V3EntityListItem, V3Kpi, V3KpiGroup, V3Page, V3PageTitle, V3PrimaryAction, V3SecondaryAction, V3Section, V3Status } from '../components/V3Primitives'
import { readClientDeepLink, writeClientDeepLink } from '../navigation/clientDeepLink'
import { V3ContactActions } from './V3ContactActions'

type ClientFilter = 'all' | 'active' | 'inactive' | 'archived' | 'balance'

interface V3ClientsPageProps {
  clients: ClientListItem[]
  properties: PropertyListItem[]
  jobs: JobListItem[]
  quotes: QuoteListItem[]
  invoices: InvoiceListItem[]
  payments: PaymentListItem[]
  recurringInvoicePlans: RecurringInvoicePlanListItem[]
  error: string | null
  initialClientId?: string | null
  onCreateInvoiceForClient: (client: ClientListItem) => void
  onCreateQuoteForClient: (client: ClientListItem) => void
  onOpenPropertyWorkspace: (propertyId: string) => void
  onOpenJobWorkspace: (jobId: string) => void
  onOpenQuoteDetail: (quoteId: string) => void
  onOpenInvoiceDetail: (invoiceId: string) => void
}

function clientBalance(clientId: string, invoices: InvoiceListItem[], payments: PaymentListItem[]): number {
  const paymentTotals = new Map<string, number>()
  for (const payment of payments) paymentTotals.set(payment.invoice_id, (paymentTotals.get(payment.invoice_id) ?? 0) + Number(payment.amount ?? 0))
  return invoices.filter((invoice) => invoice.client_id === clientId && invoice.status !== 'cancelled').reduce((sum, invoice) => {
    const paid = Number(invoice.paid_amount ?? paymentTotals.get(invoice.id) ?? 0)
    return sum + Math.max(Number(invoice.total ?? 0) - paid, 0)
  }, 0)
}

function statusTone(status: string): 'neutral' | 'success' | 'warning' {
  return status === 'inactive' || status === 'archived' ? 'neutral' : status === 'active' ? 'success' : 'warning'
}

export function V3ClientsPage(props: V3ClientsPageProps) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(props.initialClientId ?? (typeof window !== 'undefined' ? readClientDeepLink(window.location.search) : null))
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<ClientFilter>('all')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const listScrollYRef = useRef(0)
  const selectedClient = props.clients.find((client) => client.id === selectedClientId) ?? null
  const balanceByClient = useMemo(() => new Map(props.clients.map((client) => [client.id, clientBalance(client.id, props.invoices, props.payments)])), [props.clients, props.invoices, props.payments])
  const billedTotal = props.invoices.reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0)
  const openBalance = [...balanceByClient.values()].reduce((sum, value) => sum + value, 0)
  const visibleClients = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase()
    return props.clients.filter((client) => {
      if (filter === 'active' && client.status === 'inactive') return false
      if (filter === 'inactive' && client.status !== 'inactive') return false
      if (filter === 'archived' && client.status !== 'archived') return false
      if (filter === 'balance' && (balanceByClient.get(client.id) ?? 0) <= 0.009) return false
      if (!query) return true
      return [client.full_name, client.display_code, client.phone, client.email].filter(Boolean).join(' ').toLocaleLowerCase().includes(query)
    })
  }, [balanceByClient, filter, props.clients, searchQuery])

  function openClient(clientId: string) {
    listScrollYRef.current = window.scrollY
    setSelectedClientId(clientId)
    writeClientDeepLink(clientId)
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }))
  }

  function closeClient() {
    setSelectedClientId(null)
    writeClientDeepLink(null, true)
    window.requestAnimationFrame(() => window.scrollTo({ top: listScrollYRef.current, behavior: 'auto' }))
  }

  if (selectedClient) {
    return <V3ClientWorkspace client={selectedClient} properties={props.properties} jobs={props.jobs} quotes={props.quotes} invoices={props.invoices} payments={props.payments} recurringInvoicePlans={props.recurringInvoicePlans} balance={balanceByClient.get(selectedClient.id) ?? 0} onBack={closeClient} onCreateInvoice={() => props.onCreateInvoiceForClient(selectedClient)} onCreateQuote={() => props.onCreateQuoteForClient(selectedClient)} onOpenPropertyWorkspace={props.onOpenPropertyWorkspace} onOpenJobWorkspace={props.onOpenJobWorkspace} onOpenQuoteDetail={props.onOpenQuoteDetail} onOpenInvoiceDetail={props.onOpenInvoiceDetail} />
  }

  return <V3Page className="v3-clients-page">
    <V3PageTitle eyebrow="Cartera" title="Clientes" description="Contacta, revisa contexto y salta a la siguiente acción desde una lista operativa." action={<V3PrimaryAction onClick={() => setIsFilterOpen(true)}>Filtros</V3PrimaryAction>} />
    <V3KpiGroup><V3Kpi label="Clientes" value={String(props.clients.length)} hint="Fichas disponibles" /><V3Kpi label="Facturado" value={formatCurrency(billedTotal)} hint="Histórico real" /><V3Kpi label="Saldo abierto" value={formatCurrency(openBalance)} hint="Pendiente de cobro" /></V3KpiGroup>
    <section className="v3-invoice-controls" aria-label="Buscar clientes"><label className="v3-field"><span>Buscar</span><input className="v3-input" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Nombre, código, teléfono o email" /></label><button type="button" className="v3-filter-trigger" onClick={() => setIsFilterOpen(true)} aria-haspopup="dialog" aria-expanded={isFilterOpen}>Filtrar <span aria-hidden="true">⌄</span></button></section>
    <div className="v3-filter-tabs" role="tablist" aria-label="Estado de cliente">{([['all', 'Todos'], ['active', 'Activos'], ['inactive', 'Inactivos'], ['archived', 'Archivados'], ['balance', 'Con saldo']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={filter === value} className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div>
    {isFilterOpen ? <V3BottomSheet title="Filtros de clientes" onClose={() => setIsFilterOpen(false)}><div className="v3-filter-sheet__content"><fieldset className="v3-filter-sheet__group"><legend>Estado y saldo</legend><div className="v3-filter-sheet__options">{([['all', 'Todos'], ['active', 'Activos'], ['inactive', 'Inactivos'], ['archived', 'Archivados'], ['balance', 'Con saldo']] as const).map(([value, label]) => <button key={value} type="button" className={filter === value ? 'is-selected' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div></fieldset><V3PrimaryAction onClick={() => setIsFilterOpen(false)}>Aplicar filtros</V3PrimaryAction></div></V3BottomSheet> : null}
    {props.error ? <div className="v3-state v3-state--error" role="alert"><strong>Error cargando clientes</strong><p>{props.error}</p></div> : null}
    {!props.error && visibleClients.length === 0 ? <div className="v3-state"><strong>Sin clientes visibles</strong><p>Ajusta la búsqueda o el filtro para continuar.</p></div> : null}
    <div className="v3-entity-list" role="list" aria-label="Clientes">{visibleClients.map((client) => <V3ClientRow key={client.id} client={client} balance={balanceByClient.get(client.id) ?? 0} onOpen={() => openClient(client.id)} />)}</div>
  </V3Page>
}

function V3ClientRow({ client, balance, onOpen }: { client: ClientListItem; balance: number; onOpen: () => void }) {
  const statusLabel = client.status === 'inactive' ? 'Inactivo' : client.status === 'archived' ? 'Archivado' : 'Activo'
  return <V3EntityListItem onClick={onOpen} ariaLabel={`Abrir cliente ${client.full_name}`}><div className="v3-client-row__main"><strong>{client.full_name}</strong><span>{client.display_code ?? 'Sin código'} · {client.email ?? client.phone ?? 'Sin contacto'}</span><V3ContactActions phone={client.phone} email={client.email} clientName={client.full_name} compact /></div><div className="v3-client-row__side"><strong>{formatCurrency(balance)}</strong><V3Status label={statusLabel} tone={statusTone(client.status)} /></div></V3EntityListItem>
}

function V3ClientWorkspace({ client, properties, jobs, quotes, invoices, payments, recurringInvoicePlans, balance, onBack, onCreateInvoice, onCreateQuote, onOpenPropertyWorkspace, onOpenJobWorkspace, onOpenQuoteDetail, onOpenInvoiceDetail }: { client: ClientListItem; properties: PropertyListItem[]; jobs: JobListItem[]; quotes: QuoteListItem[]; invoices: InvoiceListItem[]; payments: PaymentListItem[]; recurringInvoicePlans: RecurringInvoicePlanListItem[]; balance: number; onBack: () => void; onCreateInvoice: () => void; onCreateQuote: () => void; onOpenPropertyWorkspace: (id: string) => void; onOpenJobWorkspace: (id: string) => void; onOpenQuoteDetail: (id: string) => void; onOpenInvoiceDetail: (id: string) => void }) {
  const relatedProperties = properties.filter((item) => item.client_id === client.id)
  const relatedJobs = jobs.filter((item) => item.client_id === client.id)
  const relatedQuotes = quotes.filter((item) => item.client_id === client.id)
  const relatedInvoices = invoices.filter((item) => item.client_id === client.id)
  const relatedPayments = payments.filter((payment) => relatedInvoices.some((invoice) => invoice.id === payment.invoice_id))
  const relatedPlans = recurringInvoicePlans.filter((plan) => plan.client_id === client.id)
  return <V3Page className="v3-client-workspace"><button type="button" className="v3-workspace-back" onClick={onBack}>← Clientes</button><V3PageTitle eyebrow="Ficha de cliente" title={client.full_name} description={`${client.display_code ?? 'Sin código'} · ${client.status === 'inactive' ? 'Inactivo' : 'Activo'}`} /><div className="v3-workspace-actions"><V3ContactActions phone={client.phone} email={client.email} clientName={client.full_name} /><V3PrimaryAction onClick={onCreateInvoice}>+ Nueva factura</V3PrimaryAction><V3SecondaryAction onClick={onCreateQuote}>Nuevo presupuesto</V3SecondaryAction></div>
    <V3Section label="Datos"><dl className="v3-facts"><div><dt>Teléfono</dt><dd>{client.phone ?? 'No disponible'}</dd></div><div><dt>Email</dt><dd>{client.email ?? 'No disponible'}</dd></div><div><dt>Fiscal</dt><dd>{client.tax_id ?? 'Sin NIF/CIF'}</dd></div><div><dt>Dirección</dt><dd>{client.billing_address ?? 'Sin dirección'}</dd></div></dl></V3Section>
    <V3Section label="Resumen"><dl className="v3-facts"><div><dt>Saldo pendiente</dt><dd>{formatCurrency(balance)}</dd></div><div><dt>Inmuebles</dt><dd>{relatedProperties.length}</dd></div><div><dt>Servicios</dt><dd>{relatedJobs.length}</dd></div><div><dt>Presupuestos</dt><dd>{relatedQuotes.length}</dd></div><div><dt>Facturas</dt><dd>{relatedInvoices.length}</dd></div></dl></V3Section>
    <V3RelationSection label="Inmuebles" empty="Sin inmuebles relacionados." items={relatedProperties.map((item) => ({ id: item.id, title: item.name, detail: item.address, onClick: () => onOpenPropertyWorkspace(item.id) }))} />
    <V3RelationSection label="Servicios" empty="Sin servicios relacionados." items={relatedJobs.map((item) => ({ id: item.id, title: item.display_code ?? item.service_type, detail: `${formatDateEs(item.scheduled_date)} · ${item.status}`, onClick: () => onOpenJobWorkspace(item.id) }))} />
    <V3RelationSection label="Presupuestos" empty="Sin presupuestos relacionados." items={relatedQuotes.map((item) => ({ id: item.id, title: item.display_code ?? item.id, detail: `${formatCurrency(item.total)} · ${item.status}`, onClick: () => onOpenQuoteDetail(item.id) }))} />
    <V3RelationSection label="Facturas" empty="Sin facturas relacionadas." items={relatedInvoices.map((item) => ({ id: item.id, title: item.display_code ?? item.invoice_number ?? item.id, detail: `${formatCurrency(item.total)} · ${item.status}`, onClick: () => onOpenInvoiceDetail(item.id) }))} />
    <V3Section label="Cobros"><p className="v3-section-copy">{relatedPayments.length > 0 ? `${relatedPayments.length} cobro(s) registrado(s).` : 'Sin cobros registrados.'}</p></V3Section><V3Section label="Notas"><p className="v3-section-copy">Las notas del cliente se gestionan en la ficha operativa actual.</p></V3Section>{relatedPlans.length > 0 ? <V3Section label="Planes recurrentes"><p className="v3-section-copy">{relatedPlans.length} plan(es) recurrente(s) conectado(s).</p></V3Section> : null}
  </V3Page>
}

function V3RelationSection({ label, empty, items }: { label: string; empty: string; items: Array<{ id: string; title: string; detail: string; onClick: () => void }> }) {
  return <V3Section label={label}>{items.length === 0 ? <p className="v3-section-copy">{empty}</p> : <div className="v3-relation-list">{items.map((item) => <button key={item.id} type="button" className="v3-relation-row" onClick={item.onClick}><span><strong>{item.title}</strong><small>{item.detail}</small></span><span aria-hidden="true">→</span></button>)}</div>}</V3Section>
}
