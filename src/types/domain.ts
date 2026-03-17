export type DomainEntityKey =
  | 'users'
  | 'leads'
  | 'clients'
  | 'properties'
  | 'quotes'
  | 'quote_lines'
  | 'jobs'
  | 'invoices'
  | 'payments'
  | 'settings'
  | 'kpi_snapshots'

export type BuildPhase = 'v1' | 'v2'

export interface DomainEntityDefinition {
  key: DomainEntityKey
  label: string
  description: string
  phase: BuildPhase
  module:
    | 'auth'
    | 'dashboard'
    | 'leads'
    | 'clients'
    | 'properties'
    | 'quotes'
    | 'jobs'
    | 'invoices'
    | 'payments'
    | 'kpis'
    | 'settings'
}

export type RelationshipType = 'one-to-one' | 'one-to-many' | 'many-to-one'

export interface DomainRelationshipDefinition {
  from: DomainEntityKey
  to: DomainEntityKey
  type: RelationshipType
  description: string
}
