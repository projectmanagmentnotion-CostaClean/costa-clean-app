import { useMemo, useState } from 'react'
import { ListToolbar, type ListPreferences } from '../../components/ListToolbar'
import { matchesSearchQuery } from '../documents/search'
import { getStatusLabel } from '../../app/displayText'
import { formatCurrency } from '../../app/displayFormat'
import type { ClientListItem } from '../clients/types'
import type { PropertyListItem } from '../properties/types'
import type { QuoteListItem } from './types'
import { applySortDirection, compareNumber, compareText, createDefaultPreferences } from '../lists/listPreferences'

interface QuotesListProps {
  quotes: QuoteListItem[]
  clients: ClientListItem[]
  properties: PropertyListItem[]
  error: string | null
  selectedQuoteId: string | null
  onSelectQuote: (quote: QuoteListItem) => void
}

function buildClientLabel(quote: QuoteListItem, clients: ClientListItem[]): string {
  const client = clients.find((item) => item.id === quote.client_id)
  return client?.full_name?.trim()
    || quote.client_display_code
    || quote.lead_name
    || quote.lead_display_code
    || quote.client_id
    || 'Lead sin cliente'
}

function buildPropertyLabel(quote: QuoteListItem, properties: PropertyListItem[]): string {
  if (!quote.property_id) return 'Sin propiedad'

  const property = properties.find((item) => item.id === quote.property_id)
  return property?.name?.trim() || quote.property_display_code || quote.property_id
}

export function QuotesList({
  quotes,
  clients,
  properties,
  error,
  selectedQuoteId,
  onSelectQuote,
}: QuotesListProps) {
  const defaultPreferences = useMemo(() => createDefaultPreferences('code', 'desc', { status: 'all' }), [])
  const [preferences, setPreferences] = useState<ListPreferences>(defaultPreferences)

  const filteredQuotes = useMemo(() => {
    return quotes.filter((quote) =>
      (preferences.filters.status === 'all' || quote.status === preferences.filters.status) &&
      matchesSearchQuery(preferences.searchQuery, [
        quote.display_code,
        buildClientLabel(quote, clients),
        quote.client_display_code,
        quote.lead_display_code,
        quote.lead_name,
        buildPropertyLabel(quote, properties),
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
        ? compareText(buildClientLabel(left, clients), buildClientLabel(right, clients))
        : preferences.sortField === 'property'
          ? compareText(buildPropertyLabel(left, properties), buildPropertyLabel(right, properties))
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
      <div className="section-header cc-list-section__header">
        <div>
          <h2>Presupuestos</h2>
          <p>Seguimiento comercial y conversion operativa.</p>
        </div>
        <span className="cc-list-section__count">
          {filteredQuotes.length} / {quotes.length}
        </span>
      </div>

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
          { value: 'total', label: 'Importe total' },
          { value: 'status', label: 'Estado' },
        ]}
        defaultPreferences={defaultPreferences}
        filters={[{
          key: 'status',
          label: 'Estado',
          value: preferences.filters.status ?? 'all',
          options: [
            { value: 'all', label: 'Todos' },
            { value: 'draft', label: 'Borrador' },
            { value: 'sent', label: 'Enviado' },
            { value: 'accepted', label: 'Aceptado' },
            { value: 'rejected', label: 'Rechazado' },
            { value: 'expired', label: 'Vencido' },
          ],
        }]}
        onChange={setPreferences}
      />

      {error ? (
        <div className="empty-state">
          <strong>Error cargando presupuestos</strong>
          <p>{error}</p>
        </div>
      ) : quotes.length === 0 ? (
        <div className="empty-state">
          <strong>No hay presupuestos</strong>
          <p>Todavia no existen presupuestos registrados en el sistema.</p>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="empty-state">
          <strong>Sin resultados</strong>
          <p>No encontramos presupuestos que coincidan con tu busqueda.</p>
        </div>
      ) : (
        <div className="lead-list cc-record-list cc-bounded-list">
          {filteredQuotes.map((quote) => {
            const isSelected = quote.id === selectedQuoteId
            const clientLabel = buildClientLabel(quote, clients)
            const propertyLabel = buildPropertyLabel(quote, properties)

            return (
              <button
                key={quote.id}
                type="button"
                className={
                  isSelected
                    ? 'lead-item lead-item-button selected cc-record-card cc-record-card--quote'
                    : 'lead-item lead-item-button cc-record-card cc-record-card--quote'
                }
                onClick={() => onSelectQuote(quote)}
              >
                <div className="cc-record-card__head">
                  <div className="cc-record-card__identity">
                    <strong className="cc-record-card__title">{quote.display_code ?? quote.id}</strong>
                    <span className="cc-record-card__subref">{propertyLabel}</span>
                  </div>

                  <div className="cc-record-card__aside">
                    <span className="lead-badge">{getStatusLabel(quote.status)}</span>
                    <strong className="cc-record-card__amount">{formatCurrency(quote.total)}</strong>
                  </div>
                </div>

                <p className="cc-record-card__summary">{clientLabel}</p>

                <div className="cc-record-card__chips" aria-label="Contexto del presupuesto">
                  <span className="cc-record-card__chip">Base {formatCurrency(quote.subtotal)}</span>
                  <span className="cc-record-card__chip">{propertyLabel}</span>
                </div>

                <div className="cc-list-meta cc-record-card__meta">
                  <span>
                    <span className="cc-record-card__meta-label">Base</span>
                    <span className="cc-record-card__meta-value">{formatCurrency(quote.subtotal)}</span>
                  </span>
                  <span>
                    <span className="cc-record-card__meta-label">Total</span>
                    <span className="cc-record-card__meta-value">{formatCurrency(quote.total)}</span>
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
