import type { SeverityTone } from '../../../components/SeverityBadge'
import { DSCard, DSSectionHeader } from '../../../design-system/components'
import { useGsapEntrance } from '../../../design-system/motion'

export interface HomeAlertSummaryItem {
  key: string
  title: string
  value: string
  tone: SeverityTone
  detail?: string
  onOpen: () => void
  onSeen?: () => void
  onSnooze?: () => void
  onDismiss?: () => void
}

interface HomeAlertSummaryStripProps {
  items: HomeAlertSummaryItem[]
}

export function HomeAlertSummaryStrip({ items }: HomeAlertSummaryStripProps) {
  const { scopeRef } = useGsapEntrance({
    preset: 'listStagger',
    target: '.cc-home-alert-summary__item',
  })

  return (
    <section ref={scopeRef}>
      <DSCard as="article" className="cc-home-alert-summary">
        <DSSectionHeader
          eyebrow="Alertas"
          title="Resumen"
          description="Solo lo que merece abrir modulo."
        />

        <div className="cc-home-alert-summary__grid">
          {items.map((item) => (
            <article
              key={item.key}
              className={`cc-home-alert-summary__item cc-home-alert-summary__item--${item.tone}`}
            >
              <div className="cc-home-alert-summary__top">
                <span>{item.title}</span>
                <strong>{item.value}</strong>
              </div>
              {item.detail ? <p>{item.detail}</p> : null}
              <div className="cc-home-alert-summary__actions">
                <button type="button" className="secondary-button ds-button--sm" onClick={item.onOpen}>
                  Abrir
                </button>
                {item.onSeen ? (
                  <button type="button" className="secondary-button ds-button--sm" onClick={item.onSeen}>
                    Visto
                  </button>
                ) : null}
                {item.onSnooze ? (
                  <button type="button" className="secondary-button ds-button--sm" onClick={item.onSnooze}>
                    Manana
                  </button>
                ) : null}
                {item.onDismiss ? (
                  <button type="button" className="secondary-button ds-button--sm" onClick={item.onDismiss}>
                    Ocultar
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </DSCard>
    </section>
  )
}
