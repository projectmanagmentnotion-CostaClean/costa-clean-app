import { useState } from 'react'
import type { ListFilterOption } from '../../features/lists/types'
import { DSFilterChip } from './DSFilterChip'

interface DSCompactFilterGroupProps {
  label: string
  options: ListFilterOption[]
  activeValue: string
  onSelect: (value: string) => void
  maxVisible?: number
}

export function DSCompactFilterGroup({
  label,
  options,
  activeValue,
  onSelect,
  maxVisible = 5,
}: DSCompactFilterGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const visibleOptions = isExpanded ? options : options.slice(0, maxVisible)
  const hiddenCount = Math.max(options.length - visibleOptions.length, 0)

  return (
    <section className="ds-compact-filter-group">
      <div className="ds-compact-filter-group__header">
        <strong>{label}</strong>
        <span>{options.find((option) => option.value === activeValue)?.label ?? 'Sin seleccion'}</span>
      </div>

      <div className="ds-filter-chip-row ds-filter-chip-row--compact" role="group" aria-label={label}>
        {visibleOptions.map((option) => (
          <DSFilterChip
            key={option.value}
            active={activeValue === option.value}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </DSFilterChip>
        ))}
      </div>

      {hiddenCount > 0 ? (
        <button
          type="button"
          className="ds-compact-filter-group__toggle"
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded ? 'Ver menos' : `Ver ${hiddenCount} mas`}
        </button>
      ) : null}
    </section>
  )
}
