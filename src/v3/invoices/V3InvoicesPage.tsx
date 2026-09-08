import { useMemo, useRef, useState } from 'react'
import { formatCurrency, formatDateEs } from '../../app/displayFormat'
import { formatClientLabel, formatInvoiceLabel } from '../../app/relationshipLabels'
import type { ClientListItem } from '../../features/clients/types'
import type { PaymentListItem } from '../../features/payments/types'
import { canSettleInvoiceByTransfer } from '../../features/invoices/invoiceSettlement'
import { getInvoiceFinancialStatusLabel } from '../../features/invoices/paymentState'
import type { InvoiceListItem } from '../../features/invoices/types'
import { V3BottomSheet, V3EntityListItem, V3Kpi, V3KpiGroup, V3Page, V3PageTitle, V3PrimaryAction, V3SecondaryAction, V3Section, V3Status } from '../components/V3Primitives'

interface V3InvoicesPageProps {
  invoices: InvoiceListItem[]
  allInvoices: InvoiceListItem[]
  clients: ClientListItem[]
  payments: PaymentListItem[]
  error: string | null
  initialInvoiceId?: string | null
  onCreateInvoice: () => void
  onDownloadInvoice: (invoice: InvoiceListItem) => void
  onSettleInvoice: (invoice: InvoiceListItem) => void
  isInvoiceSettling: (invoiceId: string) => boolean
  onOpenDocument: (invoice: InvoiceListItem) => void
  onViewPayments: (invoiceId: string) => void
  onOpenInvoiceDeepLink: (invoiceId: string) => void
  onBackToInvoiceList: () => void
}

type ListFilter = 'pending' | 'paid' | 'all'

function invoiceLabel(invoice: InvoiceListItem): string {
  return formatInvoiceLabel(invoice)
}

function invoiceSummary(invoice: InvoiceListItem): string {
  return invoice.service_description?.trim() || invoice.billing_concept?.trim() || invoice.service_reference?.trim() || 'Factura de servicios'
}

function getStatusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'paid') return 'success'
  if (status === 'cancelled') return 'danger'
  if (status === 'partially_paid') return 'warning'
  return 'neutral'
}

export function V3InvoicesPage({
  invoices,
  allInvoices,
  clients,
  payments,
  error,
  initialInvoiceId = null,
  onCreateInvoice,
  onDownloadInvoice,
  onSettleInvoice,
  isInvoiceSettling,
  onOpenDocument,
  onViewPayments,
  onOpenInvoiceDeepLink,
  onBackToInvoiceList,
}: V3InvoicesPageProps) {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(initialInvoiceId)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<ListFilter>('pending')
  const [sort, setSort] = useState<'recent' | 'oldest' | 'amount'>('recent')
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false)
  const listScrollYRef = useRef(0)
  const selectedInvoice = invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null

  const pendingInvoices = allInvoices.filter((invoice) => canSettleInvoiceByTransfer(invoice))
  const paidInvoices = allInvoices.filter((invoice) => invoice.payment_status === 'paid' || invoice.status === 'paid')
  const pendingAmount = pendingInvoices.reduce((sum, invoice) => sum + Number(invoice.outstanding_amount ?? invoice.total ?? 0), 0)
  const currentMonthKey = new Date().toISOString().slice(0, 7)
  const billedAmount = allInvoices
    .filter((invoice) => invoice.issue_date.startsWith(currentMonthKey))
    .reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0)

  const visibleInvoices = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase()
    return invoices
      .filter((invoice) => {
        if (filter === 'pending' && !canSettleInvoiceByTransfer(invoice)) return false
        if (filter === 'paid' && invoice.payment_status !== 'paid' && invoice.status !== 'paid') return false
        if (!query) return true
        return [invoiceLabel(invoice), formatClientLabel(invoice), invoiceSummary(invoice), invoice.issue_date]
          .join(' ').toLocaleLowerCase().includes(query)
      })
      .sort((left, right) => {
        if (sort === 'amount') return Number(right.total ?? 0) - Number(left.total ?? 0)
        const result = left.issue_date.localeCompare(right.issue_date)
        return sort === 'oldest' ? result : -result
      })
  }, [filter, invoices, searchQuery, sort])

  if (selectedInvoice) {
    return (
      <V3InvoiceWorkspace
        invoice={selectedInvoice}
        payments={payments}
        clients={clients}
        onBack={() => {
          setSelectedInvoiceId(null)
          onBackToInvoiceList()
          window.requestAnimationFrame(() => window.scrollTo({ top: listScrollYRef.current, behavior: 'auto' }))
        }}
        onDownloadInvoice={onDownloadInvoice}
        onSettleInvoice={onSettleInvoice}
        isInvoiceSettling={isInvoiceSettling(selectedInvoice.id)}
        onOpenDocument={onOpenDocument}
        onViewPayments={onViewPayments}
      />
    )
  }

  return (
    <V3Page className="v3-invoices-page">
      <V3PageTitle eyebrow="Facturación" title="Facturas" description="Emisión, cobro y saldo pendiente en una sola lectura." action={<V3PrimaryAction onClick={onCreateInvoice}>+ Nueva factura</V3PrimaryAction>} />
      <V3KpiGroup>
        <V3Kpi label="Este mes" value={formatCurrency(billedAmount)} hint="Importe facturado" />
        <V3Kpi label="Por cobrar" value={formatCurrency(pendingAmount)} hint="Saldo pendiente" />
        <V3Kpi label="Cobradas" value={String(paidInvoices.length)} hint="Estado financiero real" />
      </V3KpiGroup>
      <section className="v3-invoice-controls" aria-label="Buscar y filtrar facturas">
        <label className="v3-field"><span>Buscar</span><input className="v3-input" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Número o cliente" /></label>
        <button type="button" className="v3-filter-trigger" onClick={() => setIsFilterSheetOpen(true)} aria-haspopup="dialog" aria-expanded={isFilterSheetOpen}>Filtros <span aria-hidden="true">⌄</span></button>
      </section>
      <div className="v3-filter-tabs" role="tablist" aria-label="Estado de factura">
        {([['pending', 'Pendientes'], ['paid', 'Cobradas'], ['all', 'Todas']] as const).map(([value, label]) => (
          <button key={value} type="button" role="tab" aria-selected={filter === value} className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)}>{label}</button>
        ))}
      </div>
      {isFilterSheetOpen ? (
        <V3BottomSheet title="Filtros" onClose={() => setIsFilterSheetOpen(false)}>
          <div className="v3-filter-sheet__content">
            <fieldset className="v3-filter-sheet__group"><legend>Estado de la factura</legend><div className="v3-filter-sheet__options">{([['pending', 'Pendientes'], ['paid', 'Cobradas'], ['all', 'Todas']] as const).map(([value, label]) => <button key={value} type="button" className={filter === value ? 'is-selected' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div></fieldset>
            <label className="v3-field"><span>Ordenar por</span><select className="v3-input" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="recent">Más recientes</option><option value="oldest">Más antiguas</option><option value="amount">Mayor importe</option></select></label>
            <V3PrimaryAction onClick={() => setIsFilterSheetOpen(false)}>Aplicar filtros</V3PrimaryAction>
          </div>
        </V3BottomSheet>
      ) : null}
      {error ? <div className="v3-state v3-state--error" role="alert"><strong>Error cargando facturas</strong><p>{error}</p></div> : null}
      {!error && visibleInvoices.length === 0 ? <div className="v3-state"><strong>Sin facturas visibles</strong><p>Ajusta la búsqueda o el estado para continuar.</p></div> : null}
      <div className="v3-entity-list" role="list" aria-label="Facturas">
        {visibleInvoices.map((invoice) => (
          <V3InvoiceRow key={invoice.id} invoice={invoice} isSettling={isInvoiceSettling(invoice.id)} onOpen={() => {
            listScrollYRef.current = window.scrollY
            setSelectedInvoiceId(invoice.id)
            onOpenInvoiceDeepLink(invoice.id)
            window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }))
          }} onDownload={() => onDownloadInvoice(invoice)} onSettle={() => onSettleInvoice(invoice)} />
        ))}
      </div>
    </V3Page>
  )
}

function V3InvoiceRow({ invoice, isSettling, onOpen, onDownload, onSettle }: { invoice: InvoiceListItem; isSettling: boolean; onOpen: () => void; onDownload: () => void; onSettle: () => void }) {
  const rawStatus = invoice.payment_status ?? invoice.status
  const financialStatus = rawStatus === 'issued' ? 'pending' : rawStatus as 'pending' | 'partially_paid' | 'paid' | 'cancelled'
  const canSettle = canSettleInvoiceByTransfer(invoice)
  return (
      <V3EntityListItem onClick={onOpen} ariaLabel={`Abrir ${invoiceLabel(invoice)}`}>
      <div className="v3-invoice-row__main"><strong>{invoiceLabel(invoice)}</strong><span>{formatClientLabel(invoice)}</span><small>{formatDateEs(invoice.issue_date)} · {invoiceSummary(invoice)}</small></div>
      <div className="v3-invoice-row__side"><strong>{formatCurrency(invoice.total)}</strong><V3Status label={getInvoiceFinancialStatusLabel(financialStatus)} tone={getStatusTone(financialStatus)} /></div>
      <div className="v3-invoice-row__actions"><V3SecondaryAction onClick={(event) => { event.stopPropagation(); onDownload() }}>Descargar</V3SecondaryAction>{canSettle ? <V3PrimaryAction onClick={(event) => { event.stopPropagation(); onSettle() }} disabled={isSettling}>{isSettling ? 'Marcando…' : 'Marcar pagada'}</V3PrimaryAction> : null}</div>
    </V3EntityListItem>
  )
}

function V3InvoiceWorkspace({ invoice, payments, clients, onBack, onDownloadInvoice, onSettleInvoice, isInvoiceSettling, onOpenDocument, onViewPayments }: { invoice: InvoiceListItem; payments: PaymentListItem[]; clients: ClientListItem[]; onBack: () => void; onDownloadInvoice: (invoice: InvoiceListItem) => void; onSettleInvoice: (invoice: InvoiceListItem) => void; isInvoiceSettling: boolean; onOpenDocument: (invoice: InvoiceListItem) => void; onViewPayments: (invoiceId: string) => void }) {
  const invoicePayments = payments.filter((payment) => payment.invoice_id === invoice.id)
  const client = clients.find((item) => item.id === invoice.client_id)
  const financialStatus = invoice.payment_status ?? (invoice.status === 'issued' ? 'pending' : invoice.status) as 'pending' | 'partially_paid' | 'paid' | 'cancelled'
  const lines = invoice.lines?.length ? invoice.lines : invoice.invoice_lines ?? []
  const outstanding = Number(invoice.outstanding_amount ?? Math.max(Number(invoice.total ?? 0) - invoicePayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0), 0))
  return (
    <V3Page className="v3-invoice-workspace">
      <button type="button" className="v3-workspace-back" onClick={onBack}>← Facturas</button>
      <V3PageTitle eyebrow={invoiceLabel(invoice)} title={getInvoiceFinancialStatusLabel(financialStatus)} description={`${client?.full_name ?? formatClientLabel(invoice)} · ${formatDateEs(invoice.issue_date)}`} />
      <div className="v3-workspace-total"><strong>{formatCurrency(invoice.total)}</strong><span>Pendiente {formatCurrency(outstanding)}</span></div>
      <div className="v3-workspace-actions">{canSettleInvoiceByTransfer(invoice) ? <V3PrimaryAction onClick={() => onSettleInvoice(invoice)} disabled={isInvoiceSettling}>{isInvoiceSettling ? 'Marcando…' : 'Marcar pagada'}</V3PrimaryAction> : null}<V3SecondaryAction onClick={() => onDownloadInvoice(invoice)}>Descargar</V3SecondaryAction><V3SecondaryAction onClick={() => onOpenDocument(invoice)}>Documento</V3SecondaryAction></div>
      <V3Section label="Resumen"><dl className="v3-facts"><div><dt>Cliente</dt><dd>{client?.full_name ?? formatClientLabel(invoice)}</dd></div><div><dt>Fecha</dt><dd>{formatDateEs(invoice.issue_date)}</dd></div><div><dt>Estado</dt><dd><V3Status label={getInvoiceFinancialStatusLabel(financialStatus)} tone={getStatusTone(financialStatus)} /></dd></div></dl></V3Section>
      <V3Section label="Origen"><p className="v3-section-copy">{invoice.service_reference ?? invoice.job_display_code ?? invoice.quote_display_code ?? 'Origen no disponible en la factura.'}</p></V3Section>
      <V3Section label="Líneas"><div className="v3-line-list">{lines.length > 0 ? lines.map((line) => <div key={line.id} className="v3-line-row"><span>{line.concept}</span><strong>{formatCurrency(line.line_subtotal)}</strong></div>) : <p className="v3-section-copy">No hay líneas detalladas disponibles.</p>}</div></V3Section>
      <V3Section label="Cobros" action={<V3SecondaryAction onClick={() => onViewPayments(invoice.id)}>Ver cobros</V3SecondaryAction>}><p className="v3-section-copy">{invoicePayments.length > 0 ? `${invoicePayments.length} cobro(s) registrado(s).` : 'Sin cobros registrados.'}</p></V3Section>
      <V3Section label="Documento"><p className="v3-section-copy">PDF real disponible mediante el generador actual.</p><V3SecondaryAction onClick={() => onDownloadInvoice(invoice)}>Descargar PDF</V3SecondaryAction></V3Section>
      {invoice.updated_at ? <V3Section label="Historial"><p className="v3-section-copy">Última actualización: {formatDateEs(invoice.updated_at)}</p></V3Section> : null}
    </V3Page>
  )
}
