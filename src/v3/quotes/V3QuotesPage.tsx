import { useEffect, useMemo, useRef, useState } from 'react'
import type { QuoteModuleFilter } from '../../app/moduleFilters'
import { formatCurrency, formatDateEs } from '../../app/displayFormat'
import { formatClientLabel, formatInvoiceLabel, formatJobLabel, formatQuoteLabel } from '../../app/relationshipLabels'
import { getStatusLabel } from '../../app/displayText'
import type { ClientListItem } from '../../features/clients/types'
import type { InvoiceListItem } from '../../features/invoices/types'
import type { JobListItem } from '../../features/jobs/types'
import type { PropertyListItem } from '../../features/properties/types'
import type { QuoteLineItem, QuoteListItem } from '../../features/quotes/types'
import { fetchSupabaseRestList } from '../../lib/supabaseRest'
import { canConvertQuoteToInvoice } from '../../features/quotes/quoteConversion'
import { V3BottomSheet, V3EntityListItem, V3Icon, V3Kpi, V3KpiGroup, V3Page, V3PageTitle, V3PrimaryAction, V3SecondaryAction, V3Section, V3Status } from '../components/V3Primitives'
import { V3DuplicateReviewSheet } from '../components/V3DuplicateReviewSheet'
import type { DuplicateGroup } from '../../features/duplicates/types'
import { readQuoteDeepLink } from '../navigation/quoteDeepLink'
import { useV3Selection } from '../selection/useV3Selection'
import { V3SelectionActionSheet, V3SelectionBar, V3SelectionControl, V3SelectionResultSheet, V3SelectionTrigger } from '../selection/V3SelectionPrimitives'

type QuoteFilter = 'all' | 'open' | 'accepted' | 'rejected' | 'archived'
type QuoteSort = 'recent' | 'oldest' | 'amount'

interface V3QuotesPageProps {
  quotes: QuoteListItem[]
  allQuotes: QuoteListItem[]
  clients: ClientListItem[]
  properties: PropertyListItem[]
  jobs: JobListItem[]
  invoices: InvoiceListItem[]
  error: string | null
  initialQuoteId?: string | null
  onCreateQuote: () => void
  onDownloadQuote: (quote: QuoteListItem) => Promise<unknown> | unknown
  onShareQuote: (quote: QuoteListItem) => Promise<unknown>
  onConvertQuote: (quote: QuoteListItem) => Promise<string | null>
  onEditQuote?: (quote: QuoteListItem) => void
  onOpenClientWorkspace: (clientId: string) => void
  onOpenPropertyWorkspace: (propertyId: string) => void
  onOpenJobWorkspace: (jobId: string) => void
  onOpenInvoiceDetail: (invoiceId: string) => void
  onOpenQuoteDeepLink: (quoteId: string) => void
  onBackToQuoteList: () => void
  duplicateGroups?: Array<DuplicateGroup<QuoteListItem>>
  reviewStateByGroupId?: Record<string, 'open' | 'reviewed' | 'ignored'>
  onMarkDuplicateReviewed?: (groupId: string) => void
  onIgnoreDuplicateGroup?: (groupId: string) => void
  onReopenDuplicateGroup?: (groupId: string) => void
  onOpenDuplicateRecord?: (quoteId: string) => void
  activeFilter?: QuoteModuleFilter | null
  activeFilterLabel?: string | null
  onBulkDownload?: (quotes: QuoteListItem[]) => Promise<unknown>
  onBulkExportCsv?: (quotes: QuoteListItem[]) => void
}

function getInitialQuoteFilter(activeFilter: QuoteModuleFilter | null | undefined): QuoteFilter {
  if (activeFilter === 'open') return 'open'
  if (activeFilter === 'accepted_without_job' || activeFilter === 'accepted_without_job_3d') return 'accepted'
  return 'all'
}

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'accepted') return 'success'
  if (status === 'sent') return 'warning'
  if (status === 'rejected' || status === 'expired') return 'danger'
  return 'neutral'
}

function quoteLines(quote: QuoteListItem) {
  return quote.lines?.length ? quote.lines : quote.quote_lines ?? []
}

export function V3QuotesPage(props: V3QuotesPageProps) {
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(props.initialQuoteId ?? (typeof window !== 'undefined' ? readQuoteDeepLink(window.location.search) : null))
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<QuoteFilter>(() => getInitialQuoteFilter(props.activeFilter))
  const [sort, setSort] = useState<QuoteSort>('recent')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [busyQuoteId, setBusyQuoteId] = useState<string | null>(null)
  const [linesByQuoteId, setLinesByQuoteId] = useState<Map<string, QuoteLineItem[]>>(new Map())
  const listScrollYRef = useRef(0)
  const quotesWithLines = useMemo(() => props.allQuotes.map((quote) => linesByQuoteId.has(quote.id) ? { ...quote, lines: linesByQuoteId.get(quote.id) } : quote), [linesByQuoteId, props.allQuotes])
  const selectedQuote = quotesWithLines.find((quote) => quote.id === selectedQuoteId) ?? null
  const openQuotes = quotesWithLines.filter((quote) => quote.status === 'draft' || quote.status === 'sent')
  const acceptedQuotes = quotesWithLines.filter((quote) => quote.status === 'accepted')
  const openAmount = openQuotes.reduce((sum, quote) => sum + Number(quote.total ?? 0), 0)
  useEffect(() => {
    let active = true
    void Promise.all(props.allQuotes.map(async (quote) => {
      if (quote.lines?.length || quote.quote_lines?.length) return []
      try {
        return await fetchSupabaseRestList<QuoteLineItem>(`quote_lines?quote_id=eq.${encodeURIComponent(quote.id)}&select=id,quote_id,sort_order,concept,quantity,unit,unit_price,line_subtotal,created_at&order=sort_order.asc`)
      } catch {
        return []
      }
    })).then((groups) => {
      if (!active) return
      const next = new Map<string, QuoteLineItem[]>()
      groups.flat().forEach((line) => next.set(line.quote_id, [...(next.get(line.quote_id) ?? []), line]))
      setLinesByQuoteId(next)
    })
    return () => { active = false }
  }, [props.allQuotes])

  const visibleQuotes = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase()
    return quotesWithLines.filter((quote) => {
      const archived = Boolean(quote.archived_at || quote.deleted_at || quote.status === 'archived')
      if (filter === 'archived' && !archived) return false
      if (filter === 'open' && (archived || !['draft', 'sent'].includes(quote.status))) return false
      if (filter === 'accepted' && (archived || quote.status !== 'accepted')) return false
      if (filter === 'rejected' && (archived || !['rejected', 'expired'].includes(quote.status))) return false
      if (!query) return true
      return [formatQuoteLabel(quote), formatClientLabel(quote), quote.notes, quote.status].filter(Boolean).join(' ').toLocaleLowerCase().includes(query)
    }).sort((left, right) => {
      if (sort === 'amount') return Number(right.total ?? 0) - Number(left.total ?? 0)
      const result = String(left.created_at ?? '').localeCompare(String(right.created_at ?? ''))
      return sort === 'oldest' ? result : -result
    })
  }, [filter, quotesWithLines, searchQuery, sort])
  const selection = useV3Selection({ visibleIds: visibleQuotes.map((quote) => quote.id), resetKey: `${filter}|${searchQuery}` })
  const [selectionSheet, setSelectionSheet] = useState(false)
  const [selectionResult, setSelectionResult] = useState<string | null>(null)
  const [showDuplicateReview, setShowDuplicateReview] = useState(false)
  const selectedQuotes = quotesWithLines.filter((quote) => selection.selectedIds.includes(quote.id))

  function openQuote(quoteId: string) {
    listScrollYRef.current = window.scrollY
    setSelectedQuoteId(quoteId)
    props.onOpenQuoteDeepLink(quoteId)
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }))
  }

  function closeQuote() {
    setSelectedQuoteId(null)
    props.onBackToQuoteList()
    window.requestAnimationFrame(() => window.scrollTo({ top: listScrollYRef.current, behavior: 'auto' }))
  }

  async function convertQuote(quote: QuoteListItem) {
    if (busyQuoteId || !canConvertQuoteToInvoice(quote, props.invoices)) return
    setBusyQuoteId(quote.id)
    try {
      const invoiceId = await props.onConvertQuote(quote)
      if (invoiceId) props.onOpenInvoiceDetail(invoiceId)
    } finally {
      setBusyQuoteId(null)
    }
  }

  if (selectedQuote) return <V3QuoteWorkspace quote={selectedQuote} clients={props.clients} properties={props.properties} jobs={props.jobs} invoices={props.invoices} busy={busyQuoteId === selectedQuote.id} onBack={closeQuote} onDownload={() => props.onDownloadQuote(selectedQuote)} onShare={() => props.onShareQuote(selectedQuote)} onConvert={() => void convertQuote(selectedQuote)} onEdit={() => props.onEditQuote?.(selectedQuote)} onOpenClientWorkspace={props.onOpenClientWorkspace} onOpenPropertyWorkspace={props.onOpenPropertyWorkspace} onOpenJobWorkspace={props.onOpenJobWorkspace} onOpenInvoiceDetail={props.onOpenInvoiceDetail} />

  return <V3Page className="v3-quotes-page">
    <V3PageTitle eyebrow="Propuesta comercial" title="Presupuestos" description={`${props.activeFilterLabel ? `${props.activeFilterLabel} · ` : ''}Seguimiento comercial, documento y conversión real en una sola lectura.`} action={<div className="v3-workspace-actions"><V3SelectionTrigger onClick={selection.enter} />{(props.duplicateGroups?.length ?? 0) > 0 ? <V3SecondaryAction onClick={() => setShowDuplicateReview(true)}>Revisar duplicados</V3SecondaryAction> : null}<V3PrimaryAction onClick={props.onCreateQuote}>+ Nuevo presupuesto</V3PrimaryAction></div>} />
    <V3KpiGroup><V3Kpi label="En curso" value={String(openQuotes.length)} hint="Borradores y enviados" /><V3Kpi label="Importe en curso" value={formatCurrency(openAmount)} hint="Total real" /><V3Kpi label="Aceptados" value={String(acceptedQuotes.length)} hint="Estado comercial" /></V3KpiGroup>
    <section className="v3-invoice-controls" aria-label="Buscar presupuestos"><label className="v3-field"><span>Buscar</span><input className="v3-input" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Referencia, cliente o estado" /></label><button type="button" className="v3-filter-trigger" onClick={() => setIsFilterOpen(true)} aria-haspopup="dialog" aria-expanded={isFilterOpen}>Filtros <V3Icon name="chevronDown" /></button></section>
    <div className="v3-filter-tabs" role="tablist" aria-label="Estado del presupuesto">{([['all', 'Todos'], ['open', 'En curso'], ['accepted', 'Aceptados'], ['rejected', 'Rechazados'], ['archived', 'Archivados']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={filter === value} className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div>
    {isFilterOpen ? <V3BottomSheet title="Filtros de presupuestos" onClose={() => setIsFilterOpen(false)}><div className="v3-filter-sheet__content"><fieldset className="v3-filter-sheet__group"><legend>Estado real</legend><div className="v3-filter-sheet__options">{([['all', 'Todos'], ['open', 'En curso'], ['accepted', 'Aceptados'], ['rejected', 'Rechazados'], ['archived', 'Archivados']] as const).map(([value, label]) => <button key={value} type="button" className={filter === value ? 'is-selected' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div></fieldset><label className="v3-field"><span>Ordenar por</span><select className="v3-input" value={sort} onChange={(event) => setSort(event.target.value as QuoteSort)}><option value="recent">Más recientes</option><option value="oldest">Más antiguos</option><option value="amount">Mayor importe</option></select></label><V3PrimaryAction onClick={() => setIsFilterOpen(false)}>Aplicar filtros</V3PrimaryAction></div></V3BottomSheet> : null}
    {props.error ? <div className="v3-state v3-state--error" role="alert"><strong>Error cargando presupuestos</strong><p>{props.error}</p></div> : null}
    {!props.error && visibleQuotes.length === 0 ? <div className="v3-state"><strong>Sin presupuestos visibles</strong><p>Ajusta la búsqueda o el estado para continuar.</p></div> : null}
    <div className="v3-entity-list" role="list" aria-label="Presupuestos">{visibleQuotes.map((quote) => <V3QuoteRow key={quote.id} quote={quote} clients={props.clients} selectionMode={selection.isSelectionMode} selected={selection.selectedIds.includes(quote.id)} onToggleSelect={() => selection.toggle(quote.id)} onOpen={() => selection.isSelectionMode ? selection.toggle(quote.id) : openQuote(quote.id)} onDownload={() => props.onDownloadQuote(quote)} onConvert={() => void convertQuote(quote)} isBusy={busyQuoteId === quote.id} canConvert={canConvertQuoteToInvoice(quote, props.invoices)} />)}</div>
    {selection.isSelectionMode ? <V3SelectionBar selectedCount={selection.selectedCount} visibleSelectedCount={selection.visibleSelectedCount} visibleCount={visibleQuotes.length} allVisibleSelected={selection.allVisibleSelected} onSelectVisible={selection.selectVisible} onActions={() => setSelectionSheet(true)} onCancel={selection.exit} /> : null}
    {selectionSheet ? <V3SelectionActionSheet onClose={() => setSelectionSheet(false)}><V3SecondaryAction onClick={() => { setSelectionSheet(false); void props.onBulkDownload?.(selectedQuotes).then(() => setSelectionResult(`${selectedQuotes.length} presupuesto(s) preparados en ZIP.`)) }} disabled={selectedQuotes.length === 0}>Descargar PDFs</V3SecondaryAction><V3PrimaryAction onClick={() => { setSelectionSheet(false); props.onBulkExportCsv?.(selectedQuotes); setSelectionResult(`${selectedQuotes.length} presupuesto(s) exportados.`) }} disabled={selectedQuotes.length === 0}>Exportar CSV</V3PrimaryAction></V3SelectionActionSheet> : null}
    {selectionResult ? <V3SelectionResultSheet message={selectionResult} onClose={() => { setSelectionResult(null); selection.exit() }} /> : null}
    {showDuplicateReview && props.duplicateGroups?.length ? <V3DuplicateReviewSheet title="Revisión de presupuestos duplicados" description="Revisa coincidencias antes de crear o convertir otro presupuesto." groups={props.duplicateGroups} reviewStateByGroupId={props.reviewStateByGroupId} onMarkReviewed={props.onMarkDuplicateReviewed ?? (() => undefined)} onIgnoreGroup={props.onIgnoreDuplicateGroup ?? (() => undefined)} onReopenGroup={props.onReopenDuplicateGroup ?? (() => undefined)} onClose={() => setShowDuplicateReview(false)} onOpenRecord={(quoteId) => { setShowDuplicateReview(false); props.onOpenDuplicateRecord?.(quoteId) }} /> : null}
  </V3Page>
}

function V3QuoteRow({ quote, clients, selectionMode, selected, onToggleSelect, onOpen, onDownload, onConvert, isBusy, canConvert }: { quote: QuoteListItem; clients: ClientListItem[]; selectionMode: boolean; selected: boolean; onToggleSelect: () => void; onOpen: () => void; onDownload: () => void; onConvert: () => void; isBusy: boolean; canConvert: boolean }) {
  const label = formatQuoteLabel({ ...quote, client_name: clients.find((client) => client.id === quote.client_id)?.full_name ?? null })
  return <V3EntityListItem onClick={onOpen} ariaLabel={`Abrir presupuesto ${label}`}>{selectionMode ? <V3SelectionControl checked={selected} label={`Seleccionar ${label}`} onChange={onToggleSelect} /> : null}<div className="v3-quote-row__main"><strong>{quote.display_code ?? quote.id}</strong><span>{formatClientLabel(quote)} · {quote.notes?.trim() || 'Presupuesto de servicios'}</span><small>{quote.created_at ? formatDateEs(quote.created_at) : 'Fecha no disponible'}</small></div><div className="v3-quote-row__side"><strong>{formatCurrency(quote.total)}</strong><V3Status label={getStatusLabel(quote.status)} tone={statusTone(quote.status)} /></div>{!selectionMode ? <div className="v3-quote-row__actions"><V3SecondaryAction onClick={(event) => { event.stopPropagation(); onDownload() }} ariaLabel={`Descargar presupuesto ${quote.display_code ?? quote.id}`}>Descargar</V3SecondaryAction>{canConvert ? <V3PrimaryAction onClick={(event) => { event.stopPropagation(); onConvert() }} disabled={isBusy} ariaLabel={`Convertir presupuesto ${quote.display_code ?? quote.id} en factura`}>{isBusy ? 'Convirtiendo…' : 'Facturar'}</V3PrimaryAction> : null}</div> : null}</V3EntityListItem>
}

function V3QuoteWorkspace({ quote, clients, properties, jobs, invoices, busy, onBack, onDownload, onShare, onConvert, onEdit, onOpenClientWorkspace, onOpenPropertyWorkspace, onOpenJobWorkspace, onOpenInvoiceDetail }: { quote: QuoteListItem; clients: ClientListItem[]; properties: PropertyListItem[]; jobs: JobListItem[]; invoices: InvoiceListItem[]; busy: boolean; onBack: () => void; onDownload: () => void; onShare: () => void; onConvert: () => void; onEdit: () => void; onOpenClientWorkspace: (id: string) => void; onOpenPropertyWorkspace: (id: string) => void; onOpenJobWorkspace: (id: string) => void; onOpenInvoiceDetail: (id: string) => void }) {
  const client = clients.find((item) => item.id === quote.client_id)
  const property = properties.find((item) => item.id === quote.property_id)
  const job = jobs.find((item) => item.id === quote.job_id)
  const invoice = invoices.find((item) => item.id === quote.invoice_id) ?? invoices.find((item) => item.quote_id === quote.id && item.status !== 'cancelled')
  const lines = quoteLines(quote)
  const convertible = canConvertQuoteToInvoice(quote, invoices)
  const quoteLabel = formatQuoteLabel(quote)
  return <V3Page className="v3-quote-workspace"><button type="button" className="v3-workspace-back" onClick={onBack}><V3Icon name="back" /> Presupuestos</button><V3PageTitle eyebrow={quoteLabel} title={getStatusLabel(quote.status)} description={`${client?.full_name ?? formatClientLabel(quote)} · ${quote.created_at ? formatDateEs(quote.created_at) : 'Fecha no disponible'}`} /><div className="v3-workspace-total"><strong>{formatCurrency(quote.total)}</strong><span>Base {formatCurrency(quote.subtotal)} · IVA {formatCurrency(quote.tax_amount ?? 0)}</span></div><div className="v3-workspace-actions">{convertible ? <V3PrimaryAction onClick={onConvert} disabled={busy} ariaLabel={`Convertir presupuesto ${quoteLabel} en factura`}>{busy ? 'Convirtiendo…' : 'Convertir en factura'}</V3PrimaryAction> : null}<V3SecondaryAction onClick={onEdit}>Editar</V3SecondaryAction><V3SecondaryAction onClick={onDownload} ariaLabel={`Descargar presupuesto ${quoteLabel}`}>Descargar PDF</V3SecondaryAction><V3SecondaryAction onClick={onShare} ariaLabel={`Compartir presupuesto ${quoteLabel}`}>Compartir</V3SecondaryAction></div>
    <V3Section label="Resumen"><dl className="v3-facts"><div><dt>Cliente</dt><dd>{client ? <button type="button" className="v3-inline-link" onClick={() => onOpenClientWorkspace(client.id)}>{client.full_name}</button> : formatClientLabel(quote)}</dd></div><div><dt>Inmueble</dt><dd>{property ? <button type="button" className="v3-inline-link" onClick={() => onOpenPropertyWorkspace(property.id)}>{property.name}</button> : 'Sin inmueble'}</dd></div><div><dt>Estado</dt><dd><V3Status label={getStatusLabel(quote.status)} tone={statusTone(quote.status)} /></dd></div></dl></V3Section>
    <V3Section label="Líneas"><div className="v3-line-list">{lines.length > 0 ? lines.map((line) => <div className="v3-line-row" key={line.id}><span>{line.concept}<small>{line.quantity} {line.unit ?? 'servicio'} · {formatCurrency(line.unit_price)}</small></span><strong>{formatCurrency(line.line_subtotal)}</strong></div>) : <p className="v3-section-copy">No hay líneas disponibles.</p>}</div></V3Section>
    <V3Section label="Origen / relaciones"><div className="v3-related-links">{job ? <button type="button" className="v3-inline-link" onClick={() => onOpenJobWorkspace(job.id)}>Servicio {formatJobLabel(job)}</button> : <span className="v3-section-copy">Sin servicio asociado.</span>}{invoice ? <button type="button" className="v3-inline-link" onClick={() => onOpenInvoiceDetail(invoice.id)}>Factura {formatInvoiceLabel(invoice)}</button> : <span className="v3-section-copy">Sin factura vinculada.</span>}</div></V3Section>
    <V3Section label="Documento"><p className="v3-section-copy">PDF real generado con el renderer actual, sin subirlo a terceros.</p><V3SecondaryAction onClick={onDownload}>Descargar PDF</V3SecondaryAction></V3Section><V3Section label="Historial"><p className="v3-section-copy">Creado: {quote.created_at ? formatDateEs(quote.created_at) : 'No disponible'}{quote.updated_at ? ` · Actualizado: ${formatDateEs(quote.updated_at)}` : ''}</p></V3Section>
  </V3Page>
}
