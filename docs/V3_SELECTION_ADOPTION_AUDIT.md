# V3 Selection Adoption Audit

Audit completed against the V3-4A-certified foundation. Selection is adopted
only where a recurrent task has an existing source of truth, renderer/API and
controlled eligibility. No module-specific selection clone is permitted.

| Module | Potential bulk action | Existing contract / risk | Decision | Adopted |
|---|---|---|---|---|
| Invoices | PDF ZIP, CSV, eligible settlement | Existing generators and settlement RPC; confirmed and guarded | A | Yes |
| Quotes | PDF ZIP, CSV | Existing PDF/CSV contracts; export-only | A | Yes |
| Jobs | Work Report ZIP, invoice creation, status/archive | Renderer exists per item, but bulk writes need idempotency and duplicate guards | C | No |
| Expenses | CSV or support ZIP | No certified V3 bulk export; fiscal/support state must remain per item | B | No |
| Payments | CSV/report export | No certified V3 bulk export; financial records remain read-only | B | No |
| Leads | CSV, archive, pipeline changes | No safe mass communication or pipeline contract | B | No |
| Clients | Archive or contact actions | No approved mass contact/archive contract | B | No |
| Properties | Jobs or invoices from properties | Contextual single-record actions; bulk writes risk duplicates | B | No |
| Alerts | Dismiss/acknowledge | Decision semantics depend on key, fingerprint, scope and severity; bulk dismiss rejected | D | No |
| Closings | Select fiscal periods | Fiscal period is a scope, not an operational entity list | B | No |

## Decision

The only approved modules are Invoices and Quotes. Jobs remains a backlog item
until a real bulk document/write contract exists. No C or D proposal was
implemented. No selection was added to Home, Clients, Properties, Alerts or
Closings.

## Invariants

- One shared foundation: `src/v3/selection/`.
- No URL, localStorage or Supabase selection state.
- Search/filter/module changes reset selection; dataset changes prune IDs.
- Sensitive bulk writes require eligibility, confirmation, double-submit guard,
  refresh and partial-result reporting.
