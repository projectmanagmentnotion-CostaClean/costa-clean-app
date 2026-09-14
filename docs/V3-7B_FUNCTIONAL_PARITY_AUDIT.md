# V3-7B — Functional parity audit

Status: `CLOSED / CERTIFIED` for the source-contract audit and native V3
reachability gate. No QA writes, fixtures, SQL, production access or schema
changes were used in this block. Exact viewport certification remains deferred
to `V3-8`.

Audit basis: branch `codex/app-v3-mobile-first-redesign`, base `01f8e96`,
the V3 presentation tree, the existing functional adapters/RPC wrappers and
the focused native recurring-plan test. The V3 flag remains presentation-only;
the repository and protected contracts remain the source of truth.

## Classification

- **A — Real already existing:** V3 is connected to the current contract.
- **B — Useful coherent V3 alternative:** the existing contract is preserved
  and V3 presents the same capability through a native surface.
- **C — Intentionally retired:** the old capability is unsupported, unsafe or
  has no authoritative source of truth.
- **D — Real gap:** a missing capability that must be fixed or explicitly
  blocked before closure.

All rows below are classified. There are no unknown rows after the recurring
plan gap was closed with `src/v3/recurring/V3RecurringPlans.tsx`.

| Domain | Legacy capability | Business contract/helper | V3 path | Classification | Evidence | Action required |
|---|---|---|---|---|---|---|
| Home | Executive financial KPIs and priority queue | `dashboardMetrics`, `buildAutomationAlerts`, dashboard action routing | `src/v3/home/` via `AppShell` | A | Existing V3 home consumes the real metrics and alert inputs; no second accounting model | None |
| Alerts | List, read, acknowledge, dismiss and reopen operational alerts | `alertDecisionApi`, `buildAutomationAlerts` | `src/v3/alerts/` and `AppShell` handlers | A | Decisions and routing remain in the existing alert contract | None |
| Closings | Quarter/year readiness, save, snapshot and export | `buildClosingSummary`, closing APIs and `closingExports` | `src/v3/closing/` plus existing closing pages | A | V3 closing entry point uses the deterministic summary and persisted snapshots | None |
| Leads | Intake draft review | `markLeadDraftReviewed` | `src/v3/leads/` | A | V3 action calls the existing reviewed-draft contract | None |
| Leads | Draft-to-quote conversion | `convertReviewedLeadDraftToQuote` | V3 lead workspace | A | Existing lead, intake, VAT and line identities are preserved | None |
| Leads | Lead-to-client conversion/linking | Existing client conversion contract | V3 lead workspace | A | Duplicate protection and `source_lead_id` remain authoritative | None |
| Leads | Status, edit, archive/restore and regeneration | Existing lead write APIs | V3 lead workspace | A | V3 delegates writes to current APIs | None |
| Clients | Search and operational filters | Existing client data and filter state | `src/v3/clients/V3ClientsPage.tsx` | A | Native V3 list filters real client fields and balance data | None |
| Clients | Create/edit and duplicate protection | Existing client write flow and duplicate engine | V3 client list/workspace | A | V3 client write flow is native while persistence/duplicates stay protected | None |
| Clients | WhatsApp, call and email | Validated `V3ContactActions` URL helpers | V3 client list/workspace | B | Useful contact actions are real URL intents without delivery/read claims | None |
| Clients | Client profile media | Existing private storage/signed URL contract | V3 client profile media | A | V3-7A certified upload, replacement, removal and fallback | None |
| Clients | Relations to property/job/quote/invoice/payment | Existing foreign-key IDs and list adapters | V3 client workspace | A | Relations are derived from real IDs and open existing V3 workspaces | None |
| Properties | List/search/filter | Existing property list and relationship adapters | `src/v3/properties/` | A | Native V3 property list is the active V3 path | None |
| Properties | Create/edit/duplicate guard | `operationalWriteRpcPaths.createProperty`, duplicate groups | V3 property flow/workspace | A | V3-3D certified native write path and duplicate protection | None |
| Properties | Client/job/quote/invoice/payment relations | Existing relation IDs and workspace callbacks | V3 property workspace | A | V3-3D relation certification exists | None |
| Jobs | List/workspace/status and edit | Existing job write/lifecycle APIs | `src/v3/jobs/` | A | Native V3 jobs path preserves status and lifecycle contracts | None |
| Jobs | Job-to-invoice prefill | Existing invoice prefill/create contract | V3 job workspace | A | Completed unbilled jobs route to the protected invoice flow | None |
| Jobs | Work-report PDF/share | Existing PDF output and share fallback | V3 job workspace | B | Native presentation reuses real document output and safe share fallback | None |
| Quotes | Create/edit and dirty guard | Existing quote write flow, duplicate engine | `src/v3/quotes/` and existing orchestrator | A | V3 quote workspace preserves create/edit/dirty behavior | None |
| Quotes | Duplicate review | `findQuoteDuplicateGroups`, `V3DuplicateReviewSheet` | V3 quote create/edit | A | Native review sheet is the V3 duplicate decision surface | None |
| Quotes | PDF, share, CSV and ZIP | Existing quote PDF/share/export helpers | V3 quote list/workspace | A | Output paths remain the existing real document/export contracts | None |
| Quotes | Quote-to-job and quote-to-invoice conversion | `accept_quote_workflow` and relation refresh | V3 quote workspace | A | Conversion retains quote identity, lines, VAT and resulting invoice relation | None |
| Invoices | Create/edit and dirty guard | Existing invoice write/duplicate contracts | `src/v3/invoices/` | A | Native V3 invoice flow delegates to existing writes and guards | None |
| Invoices | Paid/cancelled locks and settlement guard | `canSettleInvoiceByTransfer`, settlement APIs | V3 invoice workspace | A | V3 never writes `status = paid` directly | None |
| Invoices | PDF, CSV, ZIP and selection | Existing invoice document/export/selection helpers | V3 invoice list/workspace | A | V3-4A selection and financial outputs are certified | None |
| Payments | Create/edit and duplicate review | Existing payment write and duplicate contracts | `src/v3/payments/` | A | V3 payment surface preserves invoice relation and duplicate guards | None |
| Payments | Automatic settlement origin | Existing `transfer_auto` read-only semantics | V3 payment workspace | A | Origin is displayed without inventing reconciliation claims | None |
| Payments | Invoice refresh after payment | `savePaymentAndRefreshInvoice` | V3 payment write path | A | Existing refresh contract remains the source of truth | None |
| Expenses | Create/edit and dirty guard | Existing expense write/edit APIs | `src/v3/expenses/` | A | V3 workspace preserves deterministic expense fields and guard | None |
| Expenses | Receipt upload, signed URL and support state | `expenseAttachmentsApi`, private storage contract | V3 expense workspace | A | V3-3B and V3-6R certified attachment persistence and no-data-loss behavior | None |
| Recurring plans | Load due plans for alerts and Home | `listRecurringInvoicePlans`, `buildAutomationAlerts` | AppShell data loading and alerts | A | Existing reads and due-alert routing were already real | None |
| Recurring plans | List and inspect plans per client | `recurring_invoice_plans` read adapter | `V3RecurringPlansSection` | B | New native list/workspace uses real plan data and V3 primitives | None |
| Recurring plans | Create/edit with template lines and relations | `buildRecurringPlanPersistenceInput`, `saveRecurringInvoicePlan` | `V3RecurringPlanFlow` | B | New V3 form keeps client/property/quote IDs, pricing and notes | None |
| Recurring plans | Duplicate review | `findRecurringPlanDuplicateGroups`, `V3DuplicateReviewSheet` | `V3RecurringPlanFlow` | B | Duplicate decision is native and explicit | None |
| Recurring plans | Pause, resume and archive | `saveRecurringInvoicePlan` status contract | `V3RecurringPlanWorkspace` | B | Status transitions are confirmed and persisted through the protected RPC | None |
| Recurring plans | Manual invoice generation | `generateInvoiceFromRecurringPlan` | V3 plan workspace | A | Generated invoice ID opens the existing V3 invoice workspace after refresh | None |
| Recurring plans | Deep link and alert entry | Existing client deep link and alert routing | Client V3 workspace | B | Current contract routes users to the client plan section; no synthetic plan URL was invented | None |
| Navigation | Main modules and More sheet | Existing `AppView` and V3 shell | `V3ShellChrome` | A | One V3 shell owns navigation; no second router or fake Settings | None |
| Search/filter | Module search, filters and deep links | Existing module filter state and deep-link helpers | V3 list/workspaces | A | V3 presentation preserves query parameters and existing filter contracts | None |
| Selection/bulk | Invoice and quote selection, CSV/PDF/ZIP | V3 selection primitives and existing export helpers | V3 invoices/quotes | A | V3-4A adopted selection only where certified; no unsupported clone added | None |
| Notifications | In-app alert state and optional browser notification | `notificationSystem`, alert decision contract | AppShell + V3 Alerts | A | Browser availability is honestly represented; in-app alerts remain authoritative | None |
| Auth/session | Authenticated shell and QA/project boundary | Existing auth/session bootstrap | AppShell/V3 shell | A | V3 does not alter auth behavior or credentials | None |
| Offline/recovery | Reload/error/empty recovery | Existing loading/error states and browser reload semantics | Shared V3 pages | B | V3 presents explicit loading/error/empty states; offline writes remain unsupported and are not claimed | None |
| Legacy presentation | V2 visual implementations reachable from V3 | V3 branch selection and Guardian tests | `AppShell` V3 branches and `src/v3/**` | C | V3 surfaces use dedicated trees; legacy implementations remain V2-only orchestration | None |
| Unsupported claims | Delivery/read/verified, GPS, telemetry, fake fiscal state | No source-of-truth contract | V3 | C | These claims remain excluded by the design and implementation contracts | None |

## Gap closure record

The one D-level gap found during the audit was recurring-plan management: V3
could read plans for alerting and show a count in a client workspace, but could
not list, inspect, create, edit, pause, resume, archive or manually generate
from a native V3 surface. It is closed by:

- `src/v3/recurring/V3RecurringPlans.tsx`, using `V3BottomSheet`,
  `V3ConfirmSheet`, `V3DuplicateReviewSheet` and existing recurring APIs.
- `src/v3/clients/V3ClientsPage.tsx`, which mounts the native section inside the
  existing client workspace without adding a route or legacy wrapper.
- `src/pages/ClientsPage.tsx` and `src/app/AppShell.tsx`, which pass the
  existing billing refresh callback after a plan mutation.
- `src/v3/recurring/V3RecurringPlans.test.tsx`, plus the full repository test,
  lint and build gates.

No new schema, RPC, storage bucket, credential, QA fixture or production path
was introduced.

## Gate result

- Classified rows: `ALL`
- Unknown rows: `0`
- Remaining D gaps: `0`
- V3 reachable legacy presentation fallback: `0` for audited surfaces
- QA writes: `0` by scope
- Production: `NOT MODIFIED`
- Exact viewport matrix: `DEFERRED TO V3-8`
