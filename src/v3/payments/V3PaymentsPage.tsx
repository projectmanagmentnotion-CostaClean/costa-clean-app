import { useMemo, useRef, useState } from 'react'
import type { PaymentModuleFilter } from '../../app/moduleFilters'
import { formatCurrency } from '../../app/displayFormat'
import type { ClientListItem } from '../../features/clients/types'
import type { InvoiceListItem } from '../../features/invoices/types'
import type { PaymentListItem } from '../../features/payments/types'
import { V3EntityList, V3EmptyState, V3Kpi, V3KpiGroup, V3Page, V3PageTitle, V3PrimaryAction, V3Search, V3Select } from '../components/V3Primitives'
import { V3PaymentRow } from './V3PaymentRow'
import { V3PaymentWorkspace } from './V3PaymentWorkspace'

interface V3PaymentsPageProps {
  payments: PaymentListItem[]
  allPayments: PaymentListItem[]
  invoices: InvoiceListItem[]
  clients: ClientListItem[]
  error: string | null
  initialPaymentId?: string | null
  activeFilter?: PaymentModuleFilter | null
  activeFilterLabel?: string | null
  onCreatePayment: () => void
  onRefresh: () => Promise<void>
  onOpenInvoice: (invoiceId: string) => void
  onOpenClient: (clientId: string) => void
  onOpenPaymentDeepLink: (paymentId: string) => void
  onBackToPaymentList: () => void
}

export function V3PaymentsPage(props: V3PaymentsPageProps) {
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(props.initialPaymentId ?? null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'recent' | 'oldest' | 'amount'>('recent')
  const listScrollYRef = useRef(0)
  const invoiceById = useMemo(() => new Map(props.invoices.map((invoice) => [invoice.id, invoice])), [props.invoices])
  const clientById = useMemo(() => new Map(props.clients.map((client) => [client.id, client])), [props.clients])
  const selectedPayment = props.payments.find((payment) => payment.id === selectedPaymentId) ?? null
  const collectedThisMonth = props.allPayments.filter((payment) => payment.payment_date.startsWith(new Date().toISOString().slice(0, 7))).reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0)
  const visiblePayments = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return props.payments.filter((payment) => {
      const invoice = invoiceById.get(payment.invoice_id)
      const client = invoice ? clientById.get(invoice.client_id) : null
      return !query || [payment.display_code, payment.invoice_display_code, payment.invoice_id, payment.payment_method, invoice?.display_code, client?.full_name].filter(Boolean).join(' ').toLocaleLowerCase().includes(query)
    }).sort((left, right) => sort === 'amount' ? Number(right.amount) - Number(left.amount) : (sort === 'oldest' ? left.payment_date.localeCompare(right.payment_date) : right.payment_date.localeCompare(left.payment_date)))
  }, [clientById, invoiceById, props.payments, search, sort])

  if (selectedPayment) {
    const invoice = invoiceById.get(selectedPayment.invoice_id) ?? null
    const client = invoice ? clientById.get(invoice.client_id) ?? null : null
    return <V3PaymentWorkspace key={selectedPayment.id} payment={selectedPayment} payments={props.allPayments} invoice={invoice} client={client} invoices={props.invoices} onBack={() => { setSelectedPaymentId(null); props.onBackToPaymentList(); window.requestAnimationFrame(() => window.scrollTo({ top: listScrollYRef.current, behavior: 'auto' })) }} onRefresh={props.onRefresh} onOpenInvoice={props.onOpenInvoice} onOpenClient={props.onOpenClient} />
  }

  return <V3Page className="v3-payments-page"><V3PageTitle eyebrow="Facturación auxiliar" title="Cobros" description={`${props.activeFilterLabel ? `${props.activeFilterLabel} · ` : ''}Registros vinculados a facturas, sin duplicar su saldo financiero.`} action={<V3PrimaryAction onClick={props.onCreatePayment}>+ Registrar cobro</V3PrimaryAction>} /><V3KpiGroup><V3Kpi label="Cobrado este mes" value={formatCurrency(collectedThisMonth)} hint="Suma real por fecha de cobro" /></V3KpiGroup><div className="v3-module-controls"><V3Search value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Factura, cliente, código o método" /><V3Select aria-label="Ordenar cobros" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="recent">Más recientes</option><option value="oldest">Más antiguos</option><option value="amount">Mayor importe</option></V3Select></div>{props.error ? <div className="v3-state v3-state--error" role="alert"><strong>Error cargando cobros</strong><p>{props.error}</p></div> : null}{!props.error && visiblePayments.length === 0 ? <V3EmptyState title="Sin cobros visibles" description="Ajusta la búsqueda o el filtro para continuar." /> : null}<V3EntityList label="Cobros">{visiblePayments.map((payment) => { const invoice = invoiceById.get(payment.invoice_id) ?? null; const client = invoice ? clientById.get(invoice.client_id) : null; return <V3PaymentRow key={payment.id} payment={payment} invoice={invoice} clientName={client?.full_name ?? 'Cliente no disponible'} onOpen={() => { listScrollYRef.current = window.scrollY; setSelectedPaymentId(payment.id); props.onOpenPaymentDeepLink(payment.id); window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' })) }} /> })}</V3EntityList></V3Page>
}
