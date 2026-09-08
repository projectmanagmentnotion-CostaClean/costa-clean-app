import { useMemo, useRef, useState } from 'react'
import { formatDateEs } from '../../app/displayFormat'
import type { ClientListItem } from '../../features/clients/types'
import type { InvoiceListItem } from '../../features/invoices/types'
import type { JobListItem } from '../../features/jobs/types'
import type { PaymentListItem } from '../../features/payments/types'
import type { PropertyListItem } from '../../features/properties/types'
import type { QuoteListItem } from '../../features/quotes/types'
import { V3EntityList, V3Kpi, V3KpiGroup, V3Page, V3PageTitle, V3PrimaryAction, V3Search, V3SecondaryAction } from '../components/V3Primitives'
import { readJobDeepLink, writeJobDeepLink } from './jobDeepLink'
import { V3JobRow } from './V3JobRow'
import { V3JobWorkspace } from './V3JobWorkspace'

type JobFilter = 'today' | 'upcoming' | 'completed' | 'all' | 'archived'

interface V3JobsPageProps { jobs: JobListItem[]; clients: ClientListItem[]; properties: PropertyListItem[]; quotes: QuoteListItem[]; invoices: InvoiceListItem[]; payments: PaymentListItem[]; error: string | null; initialJobId?: string | null; duplicateCount?: number; onReviewDuplicates?: () => void; onCreateJob: () => void; onRefresh: () => Promise<void>; onOpenClient: (id: string) => void; onOpenProperty: (id: string) => void; onOpenQuote: (id: string) => void; onOpenInvoice: (id: string) => void; onCreateInvoice: (job: JobListItem) => void }

export function V3JobsPage(props: V3JobsPageProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(props.initialJobId ?? (typeof window !== 'undefined' ? readJobDeepLink(window.location.search) : null))
  const [filter, setFilter] = useState<JobFilter>('today')
  const [search, setSearch] = useState('')
  const listScrollYRef = useRef(0)
  const invoiceByJob = useMemo(() => new Map(props.invoices.filter((invoice) => invoice.job_id).map((invoice) => [invoice.job_id as string, invoice])), [props.invoices])
  const visibleJobs = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return props.jobs.filter((job) => {
      const archived = Boolean(job.archived_at || job.deleted_at)
      if (filter === 'archived' ? !archived : archived) return false
      if (filter === 'today' && (job.scheduled_date !== today || job.status === 'cancelled')) return false
      if (filter === 'upcoming' && !(job.scheduled_date > today && job.status !== 'completed' && job.status !== 'cancelled')) return false
      if (filter === 'completed' && job.status !== 'completed') return false
      if (!query) return true
      return [job.display_code, job.billing_concept, job.service_type, job.client_name, job.client_display_code, job.property_name, job.property_display_code, job.scheduled_date].filter(Boolean).join(' ').toLocaleLowerCase().includes(query)
    }).sort((left, right) => left.scheduled_date.localeCompare(right.scheduled_date))
  }, [filter, props.jobs, search, today])
  const selectedJob = props.jobs.find((job) => job.id === selectedJobId) ?? null
  const todayCount = props.jobs.filter((job) => job.scheduled_date === today && job.status !== 'cancelled' && !job.archived_at).length
  const upcomingCount = props.jobs.filter((job) => job.scheduled_date > today && job.status !== 'completed' && job.status !== 'cancelled' && !job.archived_at).length
  const completedCount = props.jobs.filter((job) => job.status === 'completed' && !job.archived_at).length

  function openJob(id: string) { listScrollYRef.current = window.scrollY; setSelectedJobId(id); writeJobDeepLink(id); window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' })) }
  function closeJob() { setSelectedJobId(null); writeJobDeepLink(null, true); window.requestAnimationFrame(() => window.scrollTo({ top: listScrollYRef.current, behavior: 'auto' })) }

  if (selectedJob) return <V3JobWorkspace job={selectedJob} clients={props.clients} properties={props.properties} quotes={props.quotes} invoices={props.invoices} payments={props.payments} onBack={closeJob} onRefresh={props.onRefresh} onOpenClient={props.onOpenClient} onOpenProperty={props.onOpenProperty} onOpenQuote={props.onOpenQuote} onOpenInvoice={props.onOpenInvoice} onCreateInvoice={() => props.onCreateInvoice(selectedJob)} />

  return <V3Page className="v3-jobs-page"><V3PageTitle eyebrow="Agenda y ejecución" title="Servicios" description="La agenda operativa, el estado y la facturación real en una sola lectura." action={<V3PrimaryAction onClick={props.onCreateJob}>+ Nuevo</V3PrimaryAction>} /><V3KpiGroup><V3Kpi label="Hoy" value={String(todayCount)} hint={formatDateEs(today)} /><V3Kpi label="Próximos" value={String(upcomingCount)} hint="Servicios activos" /><V3Kpi label="Completados" value={String(completedCount)} hint="Estado real" /></V3KpiGroup><div className="v3-jobs-controls"><V3Search value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Código, concepto, cliente o inmueble" /><span>{visibleJobs.length} visibles</span></div>{props.duplicateCount ? <V3SecondaryAction onClick={props.onReviewDuplicates}>Revisar duplicados ({props.duplicateCount})</V3SecondaryAction> : null}<div className="v3-filter-tabs" role="tablist" aria-label="Agenda de servicios">{([['today', 'Hoy'], ['upcoming', 'Próximos'], ['completed', 'Completados'], ['all', 'Todos'], ['archived', 'Archivados']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={filter === value} className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div>{props.error ? <div className="v3-state v3-state--error" role="alert"><strong>Error cargando servicios</strong><p>{props.error}</p></div> : null}{!props.error && !visibleJobs.length ? <div className="v3-state"><strong>Sin servicios visibles</strong><p>Ajusta la búsqueda o el filtro para continuar.</p></div> : null}<V3EntityList label="Servicios">{visibleJobs.map((job) => <V3JobRow key={job.id} job={job} invoice={invoiceByJob.get(job.id) ?? null} today={today} onOpen={() => openJob(job.id)} />)}</V3EntityList></V3Page>
}
