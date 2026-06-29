import { ActionFlowOverlay } from '../../components/ActionFlowOverlay'
import { getDuplicateSeverityLabel } from './duplicateEngine'
import type { DuplicateResolutionStatus } from './duplicateResolution'
import type { DuplicateGroup, DuplicateSeverity } from './types'
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
  reviewStateByGroupId?: Record<string, 'open' | DuplicateResolutionStatus>
  onMarkReviewed?: (groupId: string) => void
  onIgnoreGroup?: (groupId: string) => void
  onReopenGroup?: (groupId: string) => void
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
  reviewStateByGroupId,
  onMarkReviewed,
  onIgnoreGroup,
  onReopenGroup,
}: DuplicateReviewOverlayProps<TRecord>) {
  const unresolvedCount = groups.filter((group) => (reviewStateByGroupId?.[group.groupId] ?? 'open') === 'open').length
  const reviewedCount = groups.filter((group) => reviewStateByGroupId?.[group.groupId] === 'reviewed').length

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
          <p>Revisa por que coinciden y decide si reutilizar, abrir, revisar o continuar igualmente.</p>
          {(unresolvedCount > 0 || reviewedCount > 0) ? (
            <div className="cc-duplicate-review__hero-stats">
              <span>{unresolvedCount} pendiente(s)</span>
              <span>{reviewedCount} revisada(s)</span>
            </div>
          ) : null}
        </section>

        {groups.map((group, groupIndex) => {
          const reviewState = reviewStateByGroupId?.[group.groupId] ?? 'open'

          return (
            <section key={group.groupId} className="cc-duplicate-review__group">
              <div className="cc-duplicate-review__group-header">
                <div className="cc-duplicate-review__group-copy">
                  <strong>Grupo {groupIndex + 1}</strong>
                  <small>{group.records.length} registro(s) relacionados</small>
                </div>
                <span className={getSeverityClassName(group.severity)}>{getDuplicateSeverityLabel(group.severity)}</span>
                {reviewState === 'reviewed' ? (
                  <span className="cc-duplicate-review__state-pill">Revisado</span>
                ) : null}
              </div>

              <div className="cc-duplicate-review__actions">
                {group.reasons.map((reason) => (
                  <span key={`${group.groupId}-${reason.code}`} className={getReasonClassName(reason.severity)}>
                    {reason.label}
                  </span>
                ))}
                {onMarkReviewed && reviewState === 'open' ? (
                  <button type="button" className="secondary-button" onClick={() => onMarkReviewed(group.groupId)}>
                    Marcar revisado
                  </button>
                ) : null}
                {onIgnoreGroup && reviewState === 'open' ? (
                  <button type="button" className="secondary-button" onClick={() => onIgnoreGroup(group.groupId)}>
                    No es duplicado
                  </button>
                ) : null}
                {onReopenGroup && reviewState !== 'open' ? (
                  <button type="button" className="secondary-button" onClick={() => onReopenGroup(group.groupId)}>
                    Volver a pendiente
                  </button>
                ) : null}
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
          )
        })}

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
