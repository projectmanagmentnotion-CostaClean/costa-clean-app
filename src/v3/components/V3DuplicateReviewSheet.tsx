import { getDuplicateSeverityLabel } from '../../features/duplicates/duplicateEngine'
import type { DuplicateGroup } from '../../features/duplicates/types'
import type { DuplicateResolutionStatus } from '../../features/duplicates/duplicateResolution'
import { V3BottomSheet, V3PrimaryAction, V3SecondaryAction } from './V3Primitives'

interface Props<TRecord> {
  title: string
  description: string
  groups: Array<DuplicateGroup<TRecord>>
  reviewStateByGroupId?: Record<string, 'open' | DuplicateResolutionStatus>
  onClose: () => void
  onOpenRecord?: (id: string) => void
  onUseRecord?: (id: string) => void
  onContinueAnyway?: () => void
  continueLabel?: string
  onMarkReviewed?: (id: string) => void
  onIgnoreGroup?: (id: string) => void
  onReopenGroup?: (id: string) => void
}

export function V3DuplicateReviewSheet<TRecord>({ title, description, groups, reviewStateByGroupId, onClose, onOpenRecord, onUseRecord, onContinueAnyway, continueLabel = 'Continuar igualmente', onMarkReviewed, onIgnoreGroup, onReopenGroup }: Props<TRecord>) {
  return <V3BottomSheet title={title} onClose={onClose}><div className="v3-duplicate-review"><p className="v3-section-copy">{description}</p>{groups.map((group, index) => { const state = reviewStateByGroupId?.[group.groupId] ?? 'open'; return <section className="v3-duplicate-review__group" key={group.groupId}><div className="v3-duplicate-review__header"><strong>Grupo {index + 1}</strong><span>{getDuplicateSeverityLabel(group.severity)}</span>{state === 'reviewed' ? <small>Revisado</small> : null}</div><div className="v3-duplicate-review__reasons">{group.reasons.map((reason) => <span key={reason.code}>{reason.label}</span>)}</div>{group.records.map((record) => <article className="v3-duplicate-review__record" key={record.recordId}><strong>{record.summary.title}</strong><span>{record.summary.subtitle}</span><div className="v3-duplicate-review__meta">{record.summary.meta.map((item, metaIndex) => <span key={`${record.recordId}-${metaIndex}`}>{item}</span>)}</div><div className="v3-workspace-actions">{onUseRecord ? <V3PrimaryAction onClick={() => onUseRecord(record.recordId)}>Usar existente</V3PrimaryAction> : null}{onOpenRecord ? <V3SecondaryAction onClick={() => onOpenRecord(record.recordId)}>Revisar existente</V3SecondaryAction> : null}</div></article>)}<div className="v3-workspace-actions">{onMarkReviewed && state === 'open' ? <V3SecondaryAction onClick={() => onMarkReviewed(group.groupId)}>Marcar revisado</V3SecondaryAction> : null}{onIgnoreGroup && state === 'open' ? <V3SecondaryAction onClick={() => onIgnoreGroup(group.groupId)}>No es duplicado</V3SecondaryAction> : null}{onReopenGroup && state !== 'open' ? <V3SecondaryAction onClick={() => onReopenGroup(group.groupId)}>Volver a pendiente</V3SecondaryAction> : null}</div></section>})}{onContinueAnyway ? <div className="v3-workspace-actions"><V3SecondaryAction onClick={onClose}>Cancelar</V3SecondaryAction><V3PrimaryAction onClick={onContinueAnyway}>{continueLabel}</V3PrimaryAction></div> : null}</div></V3BottomSheet>
}
