import { useMemo, useState } from 'react'
import { formatDateEs } from '../../app/displayFormat'
import { formatClientLabel, formatPropertyLabel, formatQuoteLabel } from '../../app/relationshipLabels'
import { getStatusLabel } from '../../app/displayText'
import { ListToolbar, type ListPreferences } from '../../components/ListToolbar'
import { DSEmptyState } from '../../design-system/components/DSEmptyState'
import { DSErrorState } from '../../design-system/components/DSErrorState'
import { DSSectionHeader } from '../../design-system/components/DSSectionHeader'
import type { ClientListItem } from '../clients/types'
import { matchesSearchQuery } from '../documents/search'
import { applySortDirection, compareNumber, compareText, createDefaultPreferences } from '../lists/listPreferences'
import type { PropertyListItem } from '../properties/types'
import type { QuoteListItem } from './types'
import { OperationalListItem } from '../../components/OperationalListItem'
import { isArchivedEntity, isDeletedEntity } from '../../shared/lifecycle/entityLifecycle'
import {
  formatQuoteCustomerFacingTotal,
} from './quoteCommercialPresentation'
import './quotesOperations.css'

interface QuotesListProps {
  quotes: QuoteListItem[]
  clients: ClientListItem[]
  properties: PropertyListItem[]
  error: string | null
  selectedQuoteId: string | null
  onSelectQuote: (quote: QuoteListItem) => void
  onOpenDocument: (quote: QuoteListItem) => void
}

interface QuoteDirectorySection {
  key: string
  label: string
  description: string
  items: QuoteListItem[]
}

function buildClientDisplay(quote: QuoteListItem, clients: ClientListItem[]): string {
  const client = clients.find((item) => item.id === quote.client_id)
  return client
    ? formatClientLabel(client)
    : quote.lead_name
      || quote.lead_display_code
      || formatClientLabel(quote)
      || 'Lead sin cliente'
}

function buildPropertyDisplay(quote: QuoteListItem, properties: PropertyListItem[]): string {
  if (!quote.property_id) return 'Sin propiedad'

  const property = properties.find((item) => item.id === quote.property_id)
  return property ? formatPropertyLabel(property) : quote.property_display_code || quote.property_id
}

function getQuoteDirectoryBucket(quote: QuoteListItem) {
  if (quote.status === 'accepted') return 'accepted'
  if (quote.status === 'draft' || quote.status === 'sent') return 'followup'
  if (quote.status === 'rejected' || quote.status === 'expired') return 'closed'
  if (quote.status === 'archived' || quote.archived_at || quote.deleted_at) return 'archive'
  return 'followup'
}

export function QuotesList({
  quotes,
  clients,
  properties,
  error,
  selectedQuoteId,
  onSelectQuote,
  onOpenDocument,
}: QuotesListProps) {
  const defaultPreferences = useMemo(() => createDefaultPreferences('code', 'desc', { status: 'active' }), [])
  const [preferences, setPreferences] = useState<ListPreferences>(defaultPreferences)

  const filteredQuotes = useMemo(() => {
    const lifecycleFilter = preferences.filters.status ?? 'active'
    return quotes.filter((quote) =>
      (() => {
        const archived = isArchivedEntity(quote)
        const deleted = isDeletedEntity(quote)

        if (lifecycleFilter === 'all') return !deleted
        if (lifecycleFilter === 'archived') return archived && !deleted
        if (deleted || archived) return false
        if (lifecycleFilter === 'active') return quote.status === 'draft' || quote.status === 'sent' || quote.status === 'accepted'
        return quote.status === lifecycleFilter
      })() &&
      matchesSearchQuery(preferences.searchQuery, [
        quote.display_code,
        buildClientDisplay(quote, clients),
        quote.client_display_code,
        quote.lead_display_code,
        quote.lead_name,
        buildPropertyDisplay(quote, properties),
        quote.property_display_code,
        quote.status,
        getStatusLabel(quote.status),
        quote.subtotal,
        quote.tax_amount,
        quote.total,
        quote.notes,
      ]),
    ).sort((left, right) => {
      const comparison = preferences.sortField === 'client'
        ? compareText(buildClientDisplay(left, clients), buildClientDisplay(right, clients))
        : preferences.sortField === 'property'
          ? compareText(buildPropertyDisplay(left, properties), buildPropertyDisplay(right, properties))
          : preferences.sortField === 'total'
            ? compareNumber(left.total, right.total)
            : preferences.sortField === 'status'
              ? compareText(getStatusLabel(left.status), getStatusLabel(right.status))
              : compareText(left.display_code ?? left.id, right.display_code ?? right.id)
      return applySortDirection(comparison, preferences.sortDirection)
    })
  }, [clients, preferences, properties, quotes])

  const directorySections = useMemo<QuoteDirectorySection[]>(() => {
    const buckets: Record<string, QuoteDirectorySection> = {
      followup: {
        key: 'followup',
        label: 'Seguimiento comercial',
        description: 'Borradores y enviados que todavía están vivos.',
        items: [],
      },
      accepted: {
        key: 'accepted',
        label: 'Aceptados',
        description: 'Presupuestos ganados que ya empujan hacia operativa.',
        items: [],
      },
      closed: {
        key: 'closed',
        label: 'Cerrados',
        description: 'Rechazados o vencidos que no siguen en curso activo.',
        items: [],
      },
      archive: {
        key: 'archive',
        label: 'Archivados',
        description: 'Histórico retraído de la bandeja principal.',
        items: [],
      },
    }

    filteredQuotes.forEach((quote) => {
      buckets[getQuoteDirectoryBucket(quote)].items.push(quote)
    })

    return Object.values(buckets).filter((section) => section.items.length > 0)
  }, [filteredQuotes])

  return (
    <section className="data-section cc-module-list-section">
      <DSSectionHeader
        title="Presupuestos"
        description="Seguimiento comercial y conversion operativa con una sola bandeja de lectura clara."
        actions={(
          <span className="cc-list-section__count">
            {filteredQuotes.length} / {quotes.length}
          </span>
        )}
      />

      <ListToolbar
        storageKey="costaclean-list-preferences-quotes"
        searchLabel="Buscar presupuesto"
        searchPlaceholder="Referencia, cliente, propiedad, estado o importe"
        resultCount={filteredQuotes.length}
        totalCount={quotes.length}
        sortOptions={[
          { value: 'code', label: 'Codigo' },
          { value: 'client', label: 'Cliente' },
          { value: 'property', label: 'Propiedad' },
          { value: 'total', label: 'Total' },
          { value: 'status', label: 'Estado' },
        ]}
        defaultPreferences={defaultPreferences}
        filters={[{
          key: 'status',
          label: 'Estado',
          value: preferences.filters.status ?? 'all',
          options: [
            { value: 'all', label: 'Todos' },
            { value: 'active', label: 'Activos' },
            { value: 'draft', label: 'Borrador' },
            { value: 'sent', label: 'Enviado' },
            { value: 'accepted', label: 'Aceptado' },
            { value: 'rejected', label: 'Rechazado' },
            { value: 'expired', label: 'Vencido' },
            { value: 'archived', label: 'Archivados' },
          ],
        }]}
        onChange={setPreferences}
      />

      {error ? (
        <DSErrorState title="Error cargando presupuestos" description={error} />
      ) : quotes.length === 0 ? (
        <DSEmptyState
          title="Todavia no hay presupuestos registrados"
          description="Cuando exista un presupuesto guardado aparecera aqui con su estado comercial y acceso al documento."
        />
      ) : filteredQuotes.length === 0 ? (
        <DSEmptyState
          title="Sin resultados"
          description="No encontramos presupuestos que coincidan con tu busqueda y los filtros activos."
        />
      ) : (
        <div className="cc-quotes-directory" aria-label="Lista de presupuestos">
          {directorySections.map((section) => (
            <section key={section.key} className="cc-quotes-directory__section">
              <header className="cc-quotes-directory__section-header">
                <div className="cc-quotes-directory__section-copy">
                  <span>{section.label}</span>
                  <strong>{section.items.length} presupuesto{section.items.length === 1 ? '' : 's'}</strong>
                  <p>{section.description}</p>
                </div>
              </header>

              <div className="cc-operational-list cc-bounded-list cc-quotes-directory__rows" role="listbox">
                {section.items.map((quote) => {
                  const isSelected = quote.id === selectedQuoteId
                  const clientLabel = buildClientDisplay(quote, clients)
                  const propertyLabel = buildPropertyDisplay(quote, properties)
                  const createdAtLabel = quote.created_at ? formatDateEs(quote.created_at) : 'Sin fecha'
                  const quoteNumber = formatQuoteLabel({
                    ...quote,
                    client_name: clients.find((item) => item.id === quote.client_id)?.full_name ?? null,
                    property_name: properties.find((item) => item.id === quote.property_id)?.name ?? null,
                  })

                  return (
                    <OperationalListItem
                      key={quote.id}
                      selected={isSelected}
                      onSelect={() => onSelectQuote(quote)}
                      title={quoteNumber}
                      subtitle={clientLabel}
                      status={<span className={`lead-badge cc-status-badge cc-status-badge--${quote.status}`}>{getStatusLabel(quote.status)}</span>}
                      aside={(
                        <strong className="cc-record-card__amount">
                          {formatQuoteCustomerFacingTotal({
                            subtotal: Number(quote.subtotal || 0),
                            total: Number(quote.total || 0),
                          })}
                        </strong>
                      )}
                      summary={propertyLabel}
                      chips={[
                        createdAtLabel,
                        quote.job_id ? 'Con servicio' : 'Sin servicio',
                      ]}
                      meta={[
                        { label: 'Lead/cliente', value: clientLabel },
                        { label: 'Propiedad', value: propertyLabel },
                      ]}
                      actions={[
                        {
                          key: 'open',
                          label: 'Abrir',
                          tone: 'primary',
                          onClick: () => onSelectQuote(quote),
                        },
                        {
                          key: 'document',
                          label: 'Abrir documento',
                          onClick: () => onOpenDocument(quote),
                        },
                      ]}
                      microhint={quote.job_id
                        ? 'Ya existe servicio vinculado'
                        : quote.status === 'accepted'
                          ? 'Listo para convertir en operativa'
                          : getStatusLabel(quote.status)}
                    />
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}
