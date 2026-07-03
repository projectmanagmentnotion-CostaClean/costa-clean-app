import { useMemo, useState } from 'react'
import { formatCurrency } from '../../app/displayFormat'
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
  getQuoteCustomerFacingTotalLabel,
} from './quoteCommercialPresentation'

interface QuotesListProps {
  quotes: QuoteListItem[]
  clients: ClientListItem[]
  properties: PropertyListItem[]
  error: string | null
  selectedQuoteId: string | null
  onSelectQuote: (quote: QuoteListItem) => void
  onOpenDocument: (quote: QuoteListItem) => void
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
          { value: 'total', label: getQuoteCustomerFacingTotalLabel() },
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
        <div className="cc-operational-list cc-bounded-list" role="listbox" aria-label="Lista de presupuestos">
          {filteredQuotes.map((quote) => {
            const isSelected = quote.id === selectedQuoteId
            const clientLabel = buildClientDisplay(quote, clients)
            const propertyLabel = buildPropertyDisplay(quote, properties)

            return (
              <OperationalListItem
                key={quote.id}
                selected={isSelected}
                onSelect={() => onSelectQuote(quote)}
                title={formatQuoteLabel({ ...quote, client_name: clients.find((item) => item.id === quote.client_id)?.full_name ?? null, property_name: properties.find((item) => item.id === quote.property_id)?.name ?? null })}
                subtitle={propertyLabel}
                status={<span className={`lead-badge cc-status-badge cc-status-badge--${quote.status}`}>{getStatusLabel(quote.status)}</span>}
                aside={(
                  <strong className="cc-record-card__amount">
                    {formatQuoteCustomerFacingTotal({
                      subtotal: Number(quote.subtotal || 0),
                      total: Number(quote.total || 0),
                    })}
                  </strong>
                )}
                summary={clientLabel}
                chips={[`${getQuoteCustomerFacingTotalLabel()} ${formatQuoteCustomerFacingTotal({ subtotal: Number(quote.subtotal || 0), total: Number(quote.total || 0) })}`, propertyLabel]}
                meta={[
                  { label: 'Base', value: formatCurrency(quote.subtotal) },
                  {
                    label: getQuoteCustomerFacingTotalLabel(),
                    value: formatQuoteCustomerFacingTotal({
                      subtotal: Number(quote.subtotal || 0),
                      total: Number(quote.total || 0),
                    }),
                  },
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
                microhint={getStatusLabel(quote.status)}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
