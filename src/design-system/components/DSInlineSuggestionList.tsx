import './design-system.css'

export interface DSInlineSuggestionItem {
  key: string
  label: string
  meta?: string
  badges?: string[]
  isActive?: boolean
  primaryLabel?: string
  secondaryLabel?: string
  onPrimary: () => void
  onSecondary?: () => void
  onHover?: () => void
}

interface DSInlineSuggestionListProps {
  items: DSInlineSuggestionItem[]
  emptyText?: string
}

export function DSInlineSuggestionList({
  items,
  emptyText = 'No hay sugerencias.',
}: DSInlineSuggestionListProps) {
  if (items.length === 0) {
    return <div className="ds-inline-suggestions ds-inline-suggestions--empty">{emptyText}</div>
  }

  return (
    <div className="ds-inline-suggestions" role="listbox">
      {items.map((item) => (
        <div
          key={item.key}
          className={['ds-inline-suggestions__item', item.isActive ? 'is-active' : ''].filter(Boolean).join(' ')}
          role="option"
          aria-selected={item.isActive}
          onMouseEnter={item.onHover}
        >
          <button
            type="button"
            className="ds-inline-suggestions__primary"
            onClick={item.onPrimary}
          >
            <span className="ds-inline-suggestions__label">{item.label}</span>
            {item.meta ? <span className="ds-inline-suggestions__meta">{item.meta}</span> : null}
            {item.badges?.length ? (
              <span className="ds-inline-suggestions__badges">
                {item.badges.slice(0, 3).map((badge) => (
                  <span key={`${item.key}-${badge}`} className="ds-inline-suggestions__badge">{badge}</span>
                ))}
              </span>
            ) : null}
          </button>
          {item.onSecondary ? (
            <div className="ds-inline-suggestions__actions">
              <button type="button" className="secondary-button ds-inline-suggestions__action" onClick={item.onSecondary}>
                {item.secondaryLabel ?? 'Mas'}
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
