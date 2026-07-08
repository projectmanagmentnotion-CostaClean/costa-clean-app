import { useState } from 'react'
import type { ListControlFilter, ListControlState, ListSortOption } from '../../features/lists/types'
import { buildSortLabel } from '../../features/lists/utils'
import { DSActiveFilters } from './DSActiveFilters'
import { DSCompactFilterGroup } from './DSCompactFilterGroup'
import { DSFilterChip } from './DSFilterChip'
import { DSFilterSummaryButton } from './DSFilterSummaryButton'
import { DSSearchInput } from './DSSearchInput'

interface DSListControlBarProps {
  searchLabel: string
  searchPlaceholder: string
  resultCount: number
  totalCount: number
  sortOptions: ListSortOption[]
  state: ListControlState
  defaultState: ListControlState
  filters?: ListControlFilter[]
  onChange: (state: ListControlState) => void
}

function FiltersIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M4.5 7h15M7.5 12h9M10 17h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SortIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M8 6.5v11M8 17.5l-2.5-2.5M8 17.5l2.5-2.5M16 17.5v-11M16 6.5 13.5 9M16 6.5 18.5 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function DSListControlBar({
  searchLabel,
  searchPlaceholder,
  resultCount,
  totalCount,
  sortOptions,
  state,
  defaultState,
  filters = [],
  onChange,
}: DSListControlBarProps) {
  const [showAdvancedControls, setShowAdvancedControls] = useState(false)
  if (totalCount === 0) return null
  const activeFilterCount = Object.entries(state.filters).filter(
    ([key, value]) => value !== (defaultState.filters[key] ?? 'all'),
  ).length
  const hasActiveControls =
    Boolean(state.searchQuery.trim()) ||
    state.sortField !== defaultState.sortField ||
    state.sortDirection !== defaultState.sortDirection ||
    activeFilterCount > 0

  const activeSummaryBits = [
    state.searchQuery.trim() ? 'busqueda' : null,
    state.sortField !== defaultState.sortField || state.sortDirection !== defaultState.sortDirection ? 'orden' : null,
    activeFilterCount > 0 ? `${activeFilterCount} filtro${activeFilterCount > 1 ? 's' : ''}` : null,
  ].filter(Boolean)

  const toolbarState = activeSummaryBits.length > 0
    ? activeSummaryBits.join(' / ')
    : buildSortLabel(sortOptions, state.sortField)

  const activeFilterItems: Array<{ key: string; label: string }> = []

  if (state.searchQuery.trim()) {
    activeFilterItems.push({ key: 'search', label: `Busqueda: ${state.searchQuery.trim()}` })
  }

  if (state.sortField !== defaultState.sortField || state.sortDirection !== defaultState.sortDirection) {
    activeFilterItems.push({
      key: 'sort',
      label: `Orden: ${buildSortLabel(sortOptions, state.sortField)}${state.sortDirection === 'asc' ? ' ascendente' : ' descendente'}`,
    })
  }

  for (const filter of filters) {
    const currentValue = state.filters[filter.key] ?? defaultState.filters[filter.key] ?? 'all'
    const defaultValue = defaultState.filters[filter.key] ?? 'all'
    if (currentValue === defaultValue) continue
    const optionLabel = filter.options.find((option) => option.value === currentValue)?.label ?? currentValue
    activeFilterItems.push({ key: filter.key, label: `${filter.label}: ${optionLabel}` })
  }

  const primaryFilter = filters[0] ?? null
  const quickFilterOptions = primaryFilter
    ? primaryFilter.options.slice(0, filters.length > 1 ? 3 : 4)
    : []
  const sortDirectionLabel = state.sortDirection === 'asc' ? 'ascendente' : 'reciente primero'

  function updateState(update: (current: ListControlState) => ListControlState) {
    onChange(update(state))
  }

  return (
    <div className="cc-list-toolbar">
      <div className="cc-list-toolbar__overview">
        <div className="cc-list-toolbar__intro">
          <span className="cc-list-toolbar__eyebrow">Lista</span>
          <strong className="cc-list-toolbar__headline">
            {resultCount} visibles de {totalCount}
          </strong>
          <span className="cc-list-toolbar__caption">
            {hasActiveControls ? 'Filtros activos' : 'Controles compactos'}
          </span>
        </div>

        <div className="cc-list-toolbar__actions">
          <span className="cc-list-toolbar__state" aria-live="polite">{toolbarState}</span>
        </div>
      </div>

      <div className="cc-list-toolbar__search">
        <DSSearchInput
          label={searchLabel}
          value={state.searchQuery}
          onChange={(searchQuery) => updateState((current) => ({ ...current, searchQuery }))}
          placeholder={searchPlaceholder}
        />
      </div>

      <div className="cc-list-toolbar__one-line" aria-label="Controles compactos de lista">
        <div className="cc-list-toolbar__quick-filters">
          {quickFilterOptions.map((option) => (
            <DSFilterChip
              key={`${primaryFilter?.key ?? 'filter'}-${option.value}`}
              active={(state.filters[primaryFilter?.key ?? ''] ?? defaultState.filters[primaryFilter?.key ?? ''] ?? 'all') === option.value}
              onClick={() => {
                if (!primaryFilter) return
                updateState((current) => ({
                  ...current,
                  filters: {
                    ...current.filters,
                    [primaryFilter.key]: option.value,
                  },
                }))
              }}
            >
              {option.label}
            </DSFilterChip>
          ))}
        </div>

        <div className="cc-list-toolbar__summary-actions">
          <DSFilterSummaryButton
            icon={<SortIcon />}
            label={`Orden: ${buildSortLabel(sortOptions, state.sortField)}`}
            detail={sortDirectionLabel}
            onClick={() => setShowAdvancedControls((current) => !current)}
            active={state.sortField !== defaultState.sortField || state.sortDirection !== defaultState.sortDirection}
            aria-expanded={showAdvancedControls}
          />

          <DSFilterSummaryButton
            icon={<FiltersIcon />}
            label="Filtros"
            detail={activeSummaryBits.length > 0 ? activeSummaryBits.join(' / ') : 'Vista base'}
            badge={activeFilterCount > 0 ? String(activeFilterCount) : null}
            onClick={() => setShowAdvancedControls((current) => !current)}
            active={showAdvancedControls || activeFilterCount > 0}
            aria-expanded={showAdvancedControls}
          />

          {hasActiveControls ? (
            <button type="button" className="secondary-button cc-list-toolbar__clear" onClick={() => onChange(defaultState)}>
              Limpiar
            </button>
          ) : null}
        </div>
      </div>

      <DSActiveFilters
        items={activeFilterItems}
        maxVisible={3}
        onClear={hasActiveControls ? () => onChange(defaultState) : undefined}
      />

      {showAdvancedControls ? (
        <>
          <button
            type="button"
            className="cc-list-toolbar__backdrop"
            aria-label="Cerrar filtros"
            onClick={() => setShowAdvancedControls(false)}
          />

          <div className="cc-list-toolbar__sheet" role="dialog" aria-modal="false" aria-label="Filtros y orden">
            <div className="cc-list-toolbar__sheet-head">
              <div className="cc-list-toolbar__panel-copy">
                <strong>Filtros y orden</strong>
                <span>{activeSummaryBits.length > 0 ? activeSummaryBits.join(' / ') : 'Vista base compacta'}</span>
              </div>
              <button type="button" className="secondary-button cc-list-toolbar__sheet-close" onClick={() => setShowAdvancedControls(false)}>
                Cerrar
              </button>
            </div>

            <div className="cc-list-toolbar__sheet-body">
              <section className="ds-compact-filter-group">
                <div className="ds-compact-filter-group__header">
                  <strong>Orden</strong>
                  <span>{buildSortLabel(sortOptions, state.sortField)}</span>
                </div>
                <div className="ds-filter-chip-row ds-filter-chip-row--compact" role="group" aria-label="Ordenar por">
                  {sortOptions.map((option) => (
                    <DSFilterChip
                      key={option.value}
                      active={state.sortField === option.value}
                      onClick={() => updateState((current) => ({ ...current, sortField: option.value }))}
                    >
                      {option.label}
                    </DSFilterChip>
                  ))}
                </div>
              </section>

              <section className="ds-compact-filter-group">
                <div className="ds-compact-filter-group__header">
                  <strong>Direccion</strong>
                  <span>{sortDirectionLabel}</span>
                </div>
                <div className="ds-filter-chip-row ds-filter-chip-row--compact" role="group" aria-label="Direccion de orden">
                  {[
                    { value: 'desc', label: 'Recientes primero' },
                    { value: 'asc', label: 'Antiguos primero' },
                  ].map((option) => (
                    <DSFilterChip
                      key={option.value}
                      active={state.sortDirection === option.value}
                      onClick={() => updateState((current) => ({
                        ...current,
                        sortDirection: option.value === 'asc' ? 'asc' : 'desc',
                      }))}
                    >
                      {option.label}
                    </DSFilterChip>
                  ))}
                </div>
              </section>

              {filters.map((filter) => (
                <DSCompactFilterGroup
                  key={filter.key}
                  label={filter.label}
                  options={filter.options}
                  activeValue={state.filters[filter.key] ?? defaultState.filters[filter.key] ?? 'all'}
                  onSelect={(value) => updateState((current) => ({
                    ...current,
                    filters: {
                      ...current.filters,
                      [filter.key]: value,
                    },
                  }))}
                />
              ))}
            </div>

            <div className="cc-list-toolbar__sheet-foot">
              {hasActiveControls ? (
                <button type="button" className="secondary-button" onClick={() => onChange(defaultState)}>
                  Limpiar vista
                </button>
              ) : null}
              <button type="button" className="primary-button" onClick={() => setShowAdvancedControls(false)}>
                Aplicar
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
