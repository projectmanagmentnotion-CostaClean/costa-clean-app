import type { ReactNode } from 'react'
import type { SeverityTone } from '../../../components/SeverityBadge'
import { VisualKpiCard } from '../../../components/VisualKpiCard'
import { DSCard, DSSectionHeader } from '../../../design-system/components'
import { useGsapEntrance } from '../../../design-system/motion'

export interface HomeFiscalKpiItem {
  actionLabel?: string
  badge: string
  detail: string
  key: string
  label: string
  onRun: () => void
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
          eyebrow="Acciones clave"
          title="Resolver ahora"
          description="Cada KPI abre una vista filtrada y util."
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
              action={{ label: item.actionLabel ?? 'Abrir', onClick: item.onRun }}
            >
              {item.visual}
            </VisualKpiCard>
          ))}
        </div>
      </DSCard>
    </section>
  )
}
