import './design-system.css'
import { DSSkeleton } from './DSSkeleton'

interface DSPageLoadingProps {
  title: string
  description?: string
  mode?: 'inline' | 'page'
  rows?: number
}

export function DSPageLoading({
  title,
  description,
  mode = 'page',
  rows = 3,
}: DSPageLoadingProps) {
  const visibleRows = Math.max(0, Math.min(rows, 3))

  return (
    <section
      className={mode === 'inline' ? 'ds-page-loading ds-page-loading--inline' : 'ds-page-loading'}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="ds-page-loading__summary">
        <strong className="ds-page-loading__title">{title}</strong>
        {description ? <p className="ds-page-loading__description">{description}</p> : null}
      </div>

      {visibleRows > 0 ? (
        <div className="ds-page-loading__rows" aria-hidden="true">
          {Array.from({ length: visibleRows }).map((_, index) => (
            <div key={`${title}-${index}`} className="ds-page-loading__row">
              <div className="ds-page-loading__row-copy">
                <DSSkeleton variant="title" className="ds-page-loading__row-title" />
                <DSSkeleton width={index === 1 ? '54%' : '68%'} className="ds-page-loading__row-text" />
              </div>
              <DSSkeleton width="4.4rem" height="1.75rem" className="ds-page-loading__row-chip" />
            </div>
          ))}
        </div>
      ) : (
        <div className="ds-page-loading__pulse" aria-hidden="true" />
      )}
    </section>
  )
}
