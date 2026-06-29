import { ActionFlowOverlay } from '../../components/ActionFlowOverlay'
import type { DuplicateGroup, DuplicateSeverity } from './types'
import { getDuplicateSeverityLabel } from './duplicateEngine'
import './duplicate-review.css'

interface DuplicateReviewOverlayProps<TRecord> {
  isOpen: boolean
  title: string
  description: string
  groups: Array<DuplicateGroup<TRecord>>
  onClose: () => void
  onOpenRecord?: (recordId: string) => void
  onUseRecord?: (recordId: string) => void
  onContinueAnyway?: () => void
  continueLabel?: string
}

function getSeverityClassName(severity: DuplicateSeverity) {
  return `cc-duplicate-review__badge cc-duplicate-review__badge--${severity}`
}

function getReasonClassName(severity: DuplicateSeverity) {
  return `cc-duplicate-review__reason cc-duplicate-review__reason--${severity}`
}

export function DuplicateReviewOverlay<TRecord>({
  isOpen,
  title,
  description,
  groups,
  onClose,
  onOpenRecord,
  onUseRecord,
  onContinueAnyway,
  continueLabel = 'Continuar igualmente',
}: DuplicateReviewOverlayProps<TRecord>) {
  return (
    <ActionFlowOverlay
      isOpen={isOpen}
      title={title}
      description={description}
      onClose={onClose}
    >
      <div className="cc-duplicate-review">
        <section className="cc-duplicate-review__hero">
          <span className="cc-duplicate-review__eyebrow">Revision de duplicados</span>
          <strong>
            Hemos encontrado {groups.reduce((count, group) => count + Math.max(group.records.length - 1, 1), 0)} posible(s) coincidencia(s).
          </strong>
          <p>Revisa por qué coinciden y decide si reutilizar, abrir o continuar igualmente.</p>
        </section>

        {groups.map((group, groupIndex) => (
          <section key={group.groupId} className="cc-duplicate-review__group">
            <div className="cc-duplicate-review__group-header">
              <div className="cc-duplicate-review__group-copy">
                <strong>Grupo {groupIndex + 1}</strong>
                <small>{group.records.length} registro(s) relacionados</small>
              </div>
              <span className={getSeverityClassName(group.severity)}>{getDuplicateSeverityLabel(group.severity)}</span>
            </div>

            <div className="cc-duplicate-review__actions">
              {group.reasons.map((reason) => (
                <span key={`${group.groupId}-${reason.code}`} className={getReasonClassName(reason.severity)}>
                  {reason.label}
                </span>
              ))}
            </div>

            <div className="cc-duplicate-review__records">
              {group.records.map((record) => (
                <article key={`${group.groupId}-${record.recordId}`} className="cc-duplicate-review__record">
                  <div className="cc-duplicate-review__record-header">
                    <div className="cc-duplicate-review__record-copy">
                      <strong>{record.summary.title}</strong>
                      <small>{record.summary.subtitle}</small>
                    </div>
                    <span className={getSeverityClassName(record.severity)}>{getDuplicateSeverityLabel(record.severity)}</span>
                  </div>

                  <div className="cc-duplicate-review__meta">
                    {record.summary.meta.map((item, metaIndex) => (
                      <span key={`${record.recordId}-meta-${metaIndex}`}>{item}</span>
                    ))}
                  </div>

                  <div className="cc-duplicate-review__fact-grid">
                    {record.summary.facts.map((fact) => (
                      <div key={`${record.recordId}-${fact.label}`} className="cc-duplicate-review__fact">
                        <span>{fact.label}</span>
                        <strong>{fact.value}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="cc-duplicate-review__actions">
                    {onUseRecord ? (
                      <button type="button" className="primary-button" onClick={() => onUseRecord(record.recordId)}>
                        Usar existente
                      </button>
                    ) : null}
                    {onOpenRecord ? (
                      <button type="button" className="secondary-button" onClick={() => onOpenRecord(record.recordId)}>
                        Revisar existente
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}

        {onContinueAnyway ? (
          <div className="cc-duplicate-review__footer">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="primary-button" onClick={onContinueAnyway}>
              {continueLabel}
            </button>
          </div>
        ) : null}
      </div>
    </ActionFlowOverlay>
  )
}
