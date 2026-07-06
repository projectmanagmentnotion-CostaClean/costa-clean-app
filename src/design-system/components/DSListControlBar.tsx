import { useState } from 'react'
import type { ListControlFilter, ListControlState, ListSortOption } from '../../features/lists/types'
import { buildSortLabel } from '../../features/lists/utils'
import { DSActiveFilters } from './DSActiveFilters'
import { DSFilterChip } from './DSFilterChip'
import { DSSearchInput } from './DSSearchInput'
import { DSSortMenu } from './DSSortMenu'

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

      <DSActiveFilters items={activeFilterItems} onClear={hasActiveControls ? () => onChange(defaultState) : undefined} />

      <details
        className="cc-list-toolbar__panel cc-collapsible-section"
        open={showAdvancedControls}
        onToggle={(event) => setShowAdvancedControls(event.currentTarget.open)}
      >
        <summary className="cc-list-toolbar__panel-summary cc-collapsible-section__summary">
          <div className="cc-list-toolbar__panel-copy">
            <strong>Filtros y orden</strong>
            <span>
              {activeSummaryBits.length > 0 ? activeSummaryBits.join(' / ') : 'Abrir controles'}
            </span>
          </div>
          {hasActiveControls ? <span className="cc-list-toolbar__panel-badge">Afinada</span> : <span className="cc-list-toolbar__panel-badge is-muted">Base</span>}
        </summary>

        <div className="cc-list-toolbar__controls" aria-label="Ordenacion y filtros de lista">
          <label className="cc-list-toolbar__field">
            <span><span className="cc-list-toolbar__field-icon" aria-hidden="true"><SortIcon /></span> Ordenar por</span>
            <DSSortMenu
              aria-label="Ordenar por"
              label=""
              value={state.sortField}
              options={sortOptions}
              onChange={(event) => updateState((current) => ({ ...current, sortField: event.target.value }))}
            />
          </label>

          <label className="cc-list-toolbar__field">
            <span><span className="cc-list-toolbar__field-icon" aria-hidden="true"><SortIcon /></span> Direccion</span>
            <DSSortMenu
              aria-label="Direccion de orden"
              label=""
              value={state.sortDirection}
              options={[
                { value: 'desc', label: 'Mayor / reciente primero' },
                { value: 'asc', label: 'Menor / antiguo primero' },
              ]}
              onChange={(event) => updateState((current) => ({
                ...current,
                sortDirection: event.target.value === 'asc' ? 'asc' : 'desc',
              }))}
            />
          </label>

          {filters.map((filter) => (
            <div key={filter.key} className="cc-list-toolbar__field cc-list-toolbar__field--chips">
              <span><span className="cc-list-toolbar__field-icon" aria-hidden="true"><FiltersIcon /></span> {filter.label}</span>
              <div className="ds-filter-chip-row" role="group" aria-label={filter.label}>
                {filter.options.map((option) => {
                  const isActive = (state.filters[filter.key] ?? defaultState.filters[filter.key] ?? 'all') === option.value

                  return (
                    <DSFilterChip
                      key={option.value}
                      active={isActive}
                      onClick={() => updateState((current) => ({
                        ...current,
                        filters: {
                          ...current.filters,
                          [filter.key]: option.value,
                        },
                      }))}
                    >
                      {option.label}
                    </DSFilterChip>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
