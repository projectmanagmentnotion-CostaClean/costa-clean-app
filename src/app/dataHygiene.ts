export type HygieneMode = 'DRY_RUN' | 'APPLY_QA'
export type HygieneEntityType = 'client' | 'property' | 'lead' | 'quote' | 'job' | 'invoice' | 'payment' | 'expense' | 'closing' | 'audit_event'
export type HygieneClassification = 'VALID_ACTIVE' | 'VALID_HISTORICAL' | 'DETERMINISTICALLY_RELINKABLE' | 'AMBIGUOUS_RELATION' | 'STALE_DRAFT' | 'ARCHIVE_CANDIDATE' | 'DATA_CORRUPTION' | 'MANUAL_REVIEW_REQUIRED'

export interface HygieneRecord {
  entityType: HygieneEntityType
  entityId: string
  relationName?: string
  currentRelationId?: string | null
  deterministicExpectedRelationId?: string | null
  relationEvidenceCount?: number
  alreadyArchived?: boolean
  fiscal?: boolean
  settled?: boolean
  requiredForHistory?: boolean
  clearlyStale?: boolean
  hasActiveReferences?: boolean
  supportsArchive?: boolean
}

interface HygieneActionBase {
  entityType: HygieneEntityType
  entityId: string
  relationName?: string
  oldValue: string | null
  newValue: string
  reason: string
  source: 'data_hygiene_n1'
}

export type HygieneAction =
  | (HygieneActionBase & { kind: 'relink'; classification: 'DETERMINISTICALLY_RELINKABLE'; relationName: string })
  | (HygieneActionBase & { kind: 'archive'; classification: 'ARCHIVE_CANDIDATE' })

export interface HygienePlan {
  actions: HygieneAction[]
  manualReview: Array<{ entityType: HygieneEntityType; entityId: string; classification: HygieneClassification; reason: string }>
}

const fiscalOrHistoricalTypes = new Set<HygieneEntityType>(['invoice', 'payment', 'expense', 'closing', 'audit_event'])
export const N1_QA_PROJECT_REF = 'kpvvydthlxupjjqqdpxy'

export function classifyHygieneRecord(record: HygieneRecord): HygieneClassification {
  if (record.alreadyArchived) return 'VALID_HISTORICAL'
  if (record.relationEvidenceCount && record.relationEvidenceCount > 1) return 'AMBIGUOUS_RELATION'

  if (record.deterministicExpectedRelationId) {
    if (fiscalOrHistoricalTypes.has(record.entityType) || record.fiscal === true || record.settled === true || record.requiredForHistory === true) {
      return record.currentRelationId === record.deterministicExpectedRelationId
        ? 'VALID_HISTORICAL'
        : 'MANUAL_REVIEW_REQUIRED'
    }
    return record.relationEvidenceCount === 1 && record.currentRelationId !== record.deterministicExpectedRelationId
      ? 'DETERMINISTICALLY_RELINKABLE'
      : 'VALID_ACTIVE'
  }

  if (record.clearlyStale) {
    const safeToArchive = !fiscalOrHistoricalTypes.has(record.entityType)
      && record.fiscal === false
      && record.settled === false
      && record.requiredForHistory === false
      && record.hasActiveReferences === false
      && record.supportsArchive === true
    return safeToArchive ? 'ARCHIVE_CANDIDATE' : 'MANUAL_REVIEW_REQUIRED'
  }

  return 'VALID_ACTIVE'
}

export function buildHygienePlan(records: HygieneRecord[]): HygienePlan {
  const actions: HygieneAction[] = []
  const manualReview: HygienePlan['manualReview'] = []

  for (const record of records) {
    const classification = classifyHygieneRecord(record)
    if (classification === 'DETERMINISTICALLY_RELINKABLE' && record.relationName && record.deterministicExpectedRelationId) {
      actions.push({
        kind: 'relink',
        classification,
        entityType: record.entityType,
        entityId: record.entityId,
        relationName: record.relationName,
        oldValue: record.currentRelationId ?? null,
        newValue: record.deterministicExpectedRelationId,
        reason: 'Asociación única demostrada por evidencia canónica.',
        source: 'data_hygiene_n1',
      })
    } else if (classification === 'ARCHIVE_CANDIDATE') {
      actions.push({
        kind: 'archive',
        classification,
        entityType: record.entityType,
        entityId: record.entityId,
        oldValue: null,
        newValue: 'archived',
        reason: 'Borrador obsoleto, no fiscal, sin liquidación ni referencias activas.',
        source: 'data_hygiene_n1',
      })
    } else if (classification === 'AMBIGUOUS_RELATION' || classification === 'MANUAL_REVIEW_REQUIRED' || classification === 'DATA_CORRUPTION') {
      manualReview.push({ entityType: record.entityType, entityId: record.entityId, classification, reason: 'No hay base segura para una corrección automática.' })
    }
  }

  return { actions, manualReview }
}

export async function runHygienePlan(
  plan: HygienePlan,
  mode: HygieneMode,
): Promise<{ plannedRelinks: number; plannedArchives: number; appliedRelinks: number; appliedArchives: number; manualReview: number }> {
  const result = {
    plannedRelinks: plan.actions.filter((action) => action.kind === 'relink').length,
    plannedArchives: plan.actions.filter((action) => action.kind === 'archive').length,
    appliedRelinks: 0,
    appliedArchives: 0,
    manualReview: plan.manualReview.length,
  }
  if (mode === 'DRY_RUN') return result
  if (plan.actions.length > 0) {
    throw new Error(`APPLY_QA está bloqueado: falta un adaptador transaccional concreto para ${N1_QA_PROJECT_REF}.`)
  }
  return result
}
