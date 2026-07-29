import { useEffect, useMemo, useState } from 'react'
import { formatClientLabel, formatInvoiceLabel } from '../../app/relationshipLabels'
import { ListToolbar, type ListPreferences, type ListToolbarAction } from '../../components/ListToolbar'
import { DSEmptyState } from '../../design-system/components/DSEmptyState'
import { DSErrorState } from '../../design-system/components/DSErrorState'
import { DSSectionHeader } from '../../design-system/components/DSSectionHeader'
import { matchesSearchQuery } from '../documents/search'
import { getStatusLabel } from '../../app/displayText'
import { formatCurrency } from '../../app/displayFormat'
import type { InvoiceListItem } from './types'
import { applySortDirection, compareDate, compareNumber, compareText, createDefaultPreferences } from '../lists/listPreferences'
import { getInvoiceFinancialStatusLabel } from './paymentState'
import { OperationalListItem } from '../../components/OperationalListItem'
import { isArchivedEntity, isCancelledEntity, isDeletedEntity } from '../../shared/lifecycle/entityLifecycle'

interface InvoicesListProps {
  invoices: InvoiceListItem[]
  error: string | null
  selectedInvoiceId: string | null
  selectedInvoiceIds?: string[]
  isSelectionMode?: boolean
  onToggleSelectionMode?: () => void
  onSelectInvoice: (invoice: InvoiceListItem) => void
  onToggleInvoiceSelection?: (invoiceId: string) => void
  onOpenDocument: (invoice: InvoiceListItem) => void
  onStateChange?: (state: {
    visibleCount: number
    totalCount: number
    hasError: boolean
    searchQuery: string
    visibleInvoices: InvoiceListItem[]
  }) => void
}

export function InvoicesList({
  invoices,
  error,
  selectedInvoiceId,
  selectedInvoiceIds = [],
  isSelectionMode = false,
  onToggleSelectionMode,
  onSelectInvoice,
  onToggleInvoiceSelection,
  onOpenDocument,
  onStateChange,
}: InvoicesListProps) {
  const defaultPreferences = useMemo(() => createDefaultPreferences('issue_date', 'desc', { status: 'pending' }), [])
  const [preferences, setPreferences] = useState<ListPreferences>(defaultPreferences)

  const filteredInvoices = useMemo(() => {
    const lifecycleFilter = preferences.filters.status ?? 'pending'
    return invoices.filter((invoice) =>
      (() => {
        const archived = isArchivedEntity(invoice)
        const deleted = isDeletedEntity(invoice)
        const cancelled = isCancelledEntity(invoice)
        const outstanding = (invoice.outstanding_amount ?? Number(invoice.total || 0)) > 0.009

        if (lifecycleFilter === 'all') return !deleted
        if (lifecycleFilter === 'archived') return archived && !deleted
        if (lifecycleFilter === 'cancelled') return cancelled && !archived && !deleted
        if (deleted || archived || cancelled) return false
        if (lifecycleFilter === 'pending') return outstanding
        if (lifecycleFilter === 'issued') return invoice.status === 'issued'
        if (lifecycleFilter === 'draft') return invoice.status === 'draft'
        if (lifecycleFilter === 'paid') return invoice.payment_status === 'paid' || invoice.status === 'paid'
        if (lifecycleFilter === 'partially_paid') return invoice.payment_status === 'partially_paid'
        return (invoice.payment_status ?? invoice.status) === lifecycleFilter
      })() &&
      matchesSearchQuery(preferences.searchQuery, [
        invoice.display_code,
        invoice.id,
        invoice.invoice_number,
        invoice.job_display_code,
        invoice.job_id,
        invoice.client_display_code,
        invoice.client_id,
        invoice.client_name,
        invoice.status,
        getStatusLabel(invoice.status),
        getInvoiceFinancialStatusLabel(invoice.payment_status ?? 'pending'),
        invoice.issue_date,
        invoice.subtotal,
        invoice.tax_amount,
        invoice.total,
        invoice.notes,
      ]),
    ).sort((left, right) => {
      const comparison = preferences.sortField === 'code'
        ? compareText(left.invoice_number ?? left.display_code ?? left.id, right.invoice_number ?? right.display_code ?? right.id)
        : preferences.sortField === 'client'
          ? compareText(formatClientLabel(left), formatClientLabel(right))
          : preferences.sortField === 'total'
            ? compareNumber(left.total, right.total)
            : preferences.sortField === 'status'
              ? compareText(getStatusLabel(left.status), getStatusLabel(right.status))
              : compareDate(left.issue_date, right.issue_date)
      return applySortDirection(comparison, preferences.sortDirection)
    })
  }, [invoices, preferences])

  useEffect(() => {
    onStateChange?.({
      visibleCount: filteredInvoices.length,
      totalCount: invoices.length,
      hasError: Boolean(error),
      searchQuery: preferences.searchQuery,
      visibleInvoices: filteredInvoices,
    })
  }, [error, filteredInvoices, filteredInvoices.length, invoices.length, onStateChange, preferences.searchQuery])

  return (
    <section className="data-section cc-module-list-section">
      <DSSectionHeader
        title="Facturas"
        description="Emision, cobro y trazabilidad documental con una sola bandeja de lectura operativa."
        actions={(
          <span className="cc-list-section__count">
            {filteredInvoices.length} / {invoices.length}
          </span>
        )}
      />

      <ListToolbar
        storageKey="costaclean-list-preferences-invoices"
        searchLabel="Buscar factura"
        searchPlaceholder="Numero, codigo interno, servicio, cliente, estado o importe"
        resultCount={filteredInvoices.length}
        totalCount={invoices.length}
        sortOptions={[
          { value: 'issue_date', label: 'Fecha de emision' },
          { value: 'code', label: 'Numero / codigo' },
          { value: 'client', label: 'Cliente' },
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
            { value: 'pending', label: 'Pendientes' },
            { value: 'issued', label: 'Emitidas' },
            { value: 'draft', label: 'Borrador' },
            { value: 'partially_paid', label: 'Parcialmente cobrada' },
            { value: 'paid', label: 'Cobrada' },
            { value: 'cancelled', label: 'Anuladas' },
            { value: 'archived', label: 'Archivadas' },
          ],
        }]}
        toolbarActions={[
          {
            id: 'selection-mode',
            label: isSelectionMode ? 'Seleccionando' : 'Seleccionar',
            detail: isSelectionMode ? `${selectedInvoiceIds.length} marcadas` : 'Acciones en lote',
            badge: isSelectionMode && selectedInvoiceIds.length > 0 ? String(selectedInvoiceIds.length) : null,
            active: isSelectionMode,
            onClick: () => onToggleSelectionMode?.(),
          } satisfies ListToolbarAction,
        ]}
        onChange={setPreferences}
      />

      {error ? (
        <DSErrorState title="Error cargando facturas" description={error} />
      ) : invoices.length === 0 ? (
        <DSEmptyState
          title="Todavia no hay facturas registradas"
          description="Cuando exista una factura guardada aparecera aqui con su estado de cobro y su acceso documental."
        />
      ) : filteredInvoices.length === 0 ? (
        <DSEmptyState
          title="Sin resultados"
          description={preferences.searchQuery.trim()
            ? `No encontramos facturas para "${preferences.searchQuery.trim()}" con los filtros activos.`
            : 'No encontramos facturas con los filtros activos.'}
        />
      ) : (
        <div className="cc-operational-list cc-bounded-list" role="listbox" aria-label="Lista de facturas">
          {filteredInvoices.map((invoice) => {
            const isSelected = invoice.id === selectedInvoiceId
            const isChecked = selectedInvoiceIds.includes(invoice.id)

            return (
              <OperationalListItem
                key={invoice.id}
                selected={isSelected}
                onSelect={() => onSelectInvoice(invoice)}
                title={formatInvoiceLabel(invoice)}
                subtitle={invoice.job_display_code ?? invoice.job_id ?? invoice.property_name ?? 'Sin origen operativo'}
                status={
                  <span className={`lead-badge cc-status-badge cc-status-badge--${invoice.payment_status ?? invoice.status}`}>
                    {getInvoiceFinancialStatusLabel(invoice.payment_status ?? 'pending')}
                  </span>
                }
                aside={<strong className="cc-record-card__amount">{formatCurrency(invoice.total)}</strong>}
                summary={formatClientLabel(invoice)}
                chips={[
                  invoice.issue_date,
                  invoice.job_display_code ?? invoice.job_id ?? invoice.property_name ?? 'Desde presupuesto aceptado',
                ]}
                meta={[
                  { label: 'Emision', value: invoice.issue_date },
                  { label: 'Origen', value: invoice.job_display_code ?? invoice.job_id ?? invoice.property_name ?? 'Presupuesto aceptado' },
                ]}
                selectionControl={isSelectionMode ? (
                  <label className="cc-record-card__selection" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggleInvoiceSelection?.(invoice.id)}
                    />
                    <span>Seleccionar factura</span>
                  </label>
                ) : undefined}
                actions={[
                  {
                    key: 'document',
                    label: invoice.status === 'draft' ? 'Previsualizar documento' : 'Abrir documento',
                    tone: 'primary',
                    onClick: () => onOpenDocument(invoice),
                  },
                  {
                    key: 'open',
                    label: 'Abrir detalle',
                    onClick: () => onSelectInvoice(invoice),
                  },
                ]}
                compactVisibleSecondaryActionCount={1}
                microhint={invoice.payment_status !== 'paid'
                  ? `Pendiente ${formatCurrency(invoice.outstanding_amount ?? invoice.total)}`
                  : 'Cobro cerrado'}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}
