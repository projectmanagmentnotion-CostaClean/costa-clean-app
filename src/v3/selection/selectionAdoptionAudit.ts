export type SelectionAdoptionDecision = 'A' | 'B' | 'C' | 'D'

export interface SelectionAdoptionAuditRow {
  module: string
  potentialBulkAction: string
  existingContract: string
  eligibility: string
  businessValue: string
  risk: string
  decision: SelectionAdoptionDecision
  adopted: boolean
}

export const V3_SELECTION_ADOPTION_AUDIT: readonly SelectionAdoptionAuditRow[] = [
  { module: 'Invoices', potentialBulkAction: 'PDF ZIP, CSV, eligible settlement', existingContract: 'Certified V3-4A exports and settlement RPC', eligibility: 'Existing invoice settlement eligibility', businessValue: 'High recurring operational value', risk: 'Controlled by confirmation and guard', decision: 'A', adopted: true },
  { module: 'Quotes', potentialBulkAction: 'PDF ZIP, CSV', existingContract: 'Certified V3-4A document generators', eligibility: 'Existing quote dataset', businessValue: 'High recurring document value', risk: 'Export-only', decision: 'A', adopted: true },
  { module: 'Jobs', potentialBulkAction: 'Work Report ZIP, invoice creation, status/archive', existingContract: 'Single-item renderer and lifecycle only', eligibility: 'Would need bulk idempotency and duplicate guards', businessValue: 'Potentially useful', risk: 'New multi-write and partial-result logic', decision: 'C', adopted: false },
  { module: 'Expenses', potentialBulkAction: 'CSV or support ZIP', existingContract: 'No certified V3 bulk export contract', eligibility: 'Support and fiscal state require per-record handling', businessValue: 'Unproven in current V3', risk: 'Could imply fiscal approval or unsafe signed-URL aggregation', decision: 'B', adopted: false },
  { module: 'Payments', potentialBulkAction: 'CSV/report export', existingContract: 'No certified V3 bulk export contract', eligibility: 'Read-only financial records', businessValue: 'Insufficient evidence today', risk: 'Must not bulk edit, delete or reconcile', decision: 'B', adopted: false },
  { module: 'Leads', potentialBulkAction: 'CSV, archive, pipeline changes', existingContract: 'Single-record lifecycle actions', eligibility: 'No safe mass communication or pipeline contract', businessValue: 'Insufficient evidence today', risk: 'Could imply contact/delivery claims', decision: 'B', adopted: false },
  { module: 'Clients', potentialBulkAction: 'Archive or contact actions', existingContract: 'Single-record contact and lifecycle actions', eligibility: 'No approved mass contact/archive contract', businessValue: 'Low recurring value', risk: 'Mass communication and invoice creation are unsafe', decision: 'B', adopted: false },
  { module: 'Properties', potentialBulkAction: 'Jobs or invoices from properties', existingContract: 'Contextual single-record create actions', eligibility: 'Needs relation-aware duplicate and idempotency guards', businessValue: 'Not a repeated list task', risk: 'Bulk writes could create duplicates', decision: 'B', adopted: false },
  { module: 'Alerts', potentialBulkAction: 'Dismiss/acknowledge', existingContract: 'Decision-specific single-alert actions', eligibility: 'alert_key, fingerprint, scope and severity', businessValue: 'Low without semantic grouping', risk: 'Bulk dismissal could hide critical alerts', decision: 'D', adopted: false },
  { module: 'Closings', potentialBulkAction: 'Select fiscal periods', existingContract: 'Period summary and save per selected period', eligibility: 'A closing is a fiscal scope, not a list entity', businessValue: 'No operational acceleration', risk: 'Could confuse fiscal state and snapshot semantics', decision: 'B', adopted: false },
]

export const V3_SELECTION_ADOPTED_MODULES = ['Invoices', 'Quotes'] as const
