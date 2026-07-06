import type { SeverityTone } from '../../../components/SeverityBadge'
import { VisualKpiCard } from '../../../components/VisualKpiCard'
import { DSCard, DSSectionHeader } from '../../../design-system/components'
import { useGsapEntrance } from '../../../design-system/motion'

export interface HomeFiscalKpiItem {
  badge: string
  detail: string
  key: string
  label: string
  onRun: () => void
  tone: SeverityTone
  value: string
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
          title="Caja y fiscal"
          description="Solo lo que cambia la decision."
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
              action={{ label: 'Abrir', onClick: item.onRun }}
            />
          ))}
        </div>
      </DSCard>
    </section>
  )
}
