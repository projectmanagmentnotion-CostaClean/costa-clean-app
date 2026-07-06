import type { ReactNode } from 'react'
import { DSEmptyState, DSCard } from '../../../design-system/components'
import { useGsapEntrance } from '../../../design-system/motion'
import { HomePeriodSelector, type HomePeriodOption } from './HomePeriodSelector'

interface HomeGsapChartCardProps {
  actionLabel?: string
  children?: ReactNode
  description: string
  emptyDescription?: string
  emptyTitle?: string
  eyebrow?: string
  hasData: boolean
  onAction?: () => void
  periodOptions?: HomePeriodOption[]
  periodValue?: string
  onPeriodChange?: (nextValue: string) => void
  title: string
  value: string
}

export function HomeGsapChartCard({
  actionLabel,
  children,
  description,
  emptyDescription = 'No hay datos suficientes para representar este grafico ahora mismo.',
  emptyTitle = 'Grafico no disponible',
  eyebrow = 'Lectura visual',
  hasData,
  onAction,
  periodOptions,
  periodValue,
  onPeriodChange,
  title,
  value,
}: HomeGsapChartCardProps) {
  const { scopeRef } = useGsapEntrance({
    preset: 'softReveal',
  })

  return (
    <section ref={scopeRef}>
      <DSCard as="article" className="cc-home-gsap-chart-card">
        <div className="cc-home-gsap-chart-card__header">
          <div className="cc-home-gsap-chart-card__copy">
            <span className="cc-home-gsap-chart-card__eyebrow">{eyebrow}</span>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
          <div className="cc-home-gsap-chart-card__meta">
            <strong className="cc-home-gsap-chart-card__value">{value}</strong>
            {periodOptions && periodValue && onPeriodChange ? (
              <HomePeriodSelector
                compact
                ariaLabel={`Periodo para ${title}`}
                options={periodOptions}
                value={periodValue}
                onChange={onPeriodChange}
              />
            ) : null}
          </div>
        </div>

        {hasData ? (
          <div className="cc-home-gsap-chart-card__body">{children}</div>
        ) : (
          <DSEmptyState title={emptyTitle} description={emptyDescription} />
        )}

        {hasData && actionLabel && onAction ? (
          <div className="cc-home-gsap-chart-card__footer">
            <button type="button" className="secondary-button ds-button--sm" onClick={onAction}>
              {actionLabel}
            </button>
          </div>
        ) : null}
      </DSCard>
    </section>
  )
}
