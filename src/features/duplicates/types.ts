export type DuplicateEntityType =
  | 'lead'
  | 'client'
  | 'property'
  | 'job'
  | 'quote'
  | 'invoice'
  | 'payment'
  | 'expense'
  | 'recurring_plan'

export type DuplicateSeverity = 'exact' | 'strong' | 'probable' | 'contextual'

export interface DuplicateReason {
  code: string
  label: string
  severity: DuplicateSeverity
}

export interface DuplicateRecordFact {
  label: string
  value: string
}

export interface DuplicateRecordSummary {
  title: string
  subtitle: string
  meta: string[]
  facts: DuplicateRecordFact[]
}

export interface DuplicateMatch<TRecord> {
  entityType: DuplicateEntityType
  recordId: string
  record: TRecord
  severity: DuplicateSeverity
  reasons: DuplicateReason[]
  summary: DuplicateRecordSummary
}

export interface DuplicateGroup<TRecord> {
  entityType: DuplicateEntityType
  groupId: string
  severity: DuplicateSeverity
  reasons: DuplicateReason[]
  records: Array<DuplicateMatch<TRecord>>
}
