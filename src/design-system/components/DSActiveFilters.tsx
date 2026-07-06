import type { ReactNode } from 'react'
import { DSTag } from './DSTag'
import './design-system.css'

interface DSActiveFilterItem {
  key: string
  label: ReactNode
}

interface DSActiveFiltersProps {
  items: DSActiveFilterItem[]
  onClear?: () => void
  maxVisible?: number
}

export function DSActiveFilters({ items, onClear, maxVisible }: DSActiveFiltersProps) {
  if (items.length === 0) {
    return null
  }

  const visibleItems = typeof maxVisible === 'number' ? items.slice(0, maxVisible) : items
  const hiddenCount = typeof maxVisible === 'number' ? Math.max(items.length - visibleItems.length, 0) : 0

  return (
    <div className="ds-active-filters" aria-label="Filtros activos">
      <div className="ds-active-filters__items">
        {visibleItems.map((item) => (
          <DSTag key={item.key} className="ds-active-filters__tag">
            {item.label}
          </DSTag>
        ))}
        {hiddenCount > 0 ? (
          <DSTag className="ds-active-filters__tag ds-active-filters__tag--summary">
            +{hiddenCount} mas
          </DSTag>
        ) : null}
      </div>

      {onClear ? (
        <button type="button" className="secondary-button ds-active-filters__clear" onClick={onClear}>
          Limpiar vista
        </button>
      ) : null}
    </div>
  )
}
