import { DSCard, DSSectionHeader } from '../../../design-system/components'
import { useGsapEntrance } from '../../../design-system/motion'

export interface HomeQuickActionItem {
  key: string
  onRun: () => void
  title: string
  detail?: string
}

interface HomeQuickActionsPanelProps {
  actions: HomeQuickActionItem[]
}

export function HomeQuickActionsPanel({ actions }: HomeQuickActionsPanelProps) {
  const { scopeRef } = useGsapEntrance({
    preset: 'listStagger',
    target: '.cc-home-quick-actions-panel__action',
  })

  return (
    <section ref={scopeRef}>
      <DSCard as="article" className="cc-home-quick-actions-panel">
        <DSSectionHeader
          eyebrow="Acciones rapidas"
          title="Acciones"
          description="Solo accesos utiles."
        />

        <div className="cc-home-quick-actions-panel__grid">
          {actions.map((action, index) => (
            <button
              key={action.key}
              type="button"
              className={`cc-home-quick-actions-panel__action${index === 0 ? ' cc-home-quick-actions-panel__action--accent' : ''}`}
              onClick={action.onRun}
            >
              <strong>{action.title}</strong>
              {action.detail ? <span>{action.detail}</span> : null}
            </button>
          ))}
        </div>
      </DSCard>
    </section>
  )
}
