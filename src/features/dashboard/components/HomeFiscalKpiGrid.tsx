import type { ReactNode } from 'react'
import type { SeverityTone } from '../../../components/SeverityBadge'
import { VisualKpiCard } from '../../../components/VisualKpiCard'
import { DSCard, DSSectionHeader } from '../../../design-system/components'
import { useGsapEntrance } from '../../../design-system/motion'
import type { HomePeriodOption } from './HomePeriodSelector'
import { HomePeriodSelector } from './HomePeriodSelector'

export interface HomeFiscalKpiItem {
  badge: string
  detail: string
  key: string
  label: string
  onRun: () => void
  periodOptions?: HomePeriodOption[]
  periodValue?: string
  onPeriodChange?: (nextValue: string) => void
  progress?: {
    label: string
    percent: number
    value?: string
    max?: string
    hint?: string
  }
  tone: SeverityTone
  value: string
  visual?: ReactNode
}

interface HomeFiscalKpiGridProps {
  items: HomeFiscalKpiItem[]
}

export function HomeFiscalKpiGrid({ items }: HomeFiscalKpiGridProps) {
  const { scopeRef } = useGsapEntrance({
    preset: 'listStagger',
    target: '.cc-home-fiscal-kpi-grid .cc-visual-kpi-card',
  })

  return (
    <section ref={scopeRef}>
      <DSCard as="article" className="cc-home-fiscal-kpi-grid">
        <DSSectionHeader
          eyebrow="Kpis operativos"
          title="KPIs"
          description="Lectura corta y accionable."
        />

        <div className="cc-home-fiscal-kpi-grid__items">
          {items.map((item) => (
            <VisualKpiCard
              key={item.key}
              label={item.label}
              value={item.value}
              hint={item.detail}
              badgeLabel={item.badge}
              tone={item.tone}
              priority="compact"
              progress={item.progress}
              action={{ label: 'Abrir', onClick: item.onRun }}
            >
              {item.periodOptions && item.periodValue && item.onPeriodChange ? (
                <HomePeriodSelector
                  compact
                  ariaLabel={`Periodo para ${item.label}`}
                  options={item.periodOptions}
                  value={item.periodValue}
                  onChange={item.onPeriodChange}
                />
              ) : null}
              {item.visual}
            </VisualKpiCard>
          ))}
        </div>
      </DSCard>
    </section>
  )
}
