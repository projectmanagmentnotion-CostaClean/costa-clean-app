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
}

export function DSActiveFilters({ items, onClear }: DSActiveFiltersProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className="ds-active-filters" aria-label="Filtros activos">
      <div className="ds-active-filters__items">
        {items.map((item) => (
          <DSTag key={item.key} className="ds-active-filters__tag">
            {item.label}
          </DSTag>
        ))}
      </div>

      {onClear ? (
        <button type="button" className="secondary-button ds-active-filters__clear" onClick={onClear}>
          Limpiar vista
        </button>
      ) : null}
    </div>
  )
}
