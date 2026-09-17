# V3-10C5P — OPERATIONS DISCOVERY AUDIT

Status: `PREPARATION COMPLETE / C5 NOT STARTED`

Repository: `C:\Users\USUARIO\costa-clean-app-v3`
Branch: `codex/app-v3-mobile-first-redesign`
Audited HEAD: `fc22069082ad4f4a50563bf7ac31dfeab2d87258`

This is a static/read-only discovery audit. No operations product file,
Supabase object, RPC, schema, policy, storage object or business data was
changed. C3 remains `OPEN — AUTHENTICATED RUNTIME CERTIFICATION PENDING`.

## 1. State and audit boundary

- V3-10B: `CLOSED / CERTIFIED`.
- V3-10C1: `CLOSED / CERTIFIED`.
- V3-10C2: `CLOSED / CERTIFIED`.
- V3-10C3: `OPEN — AUTHENTICATED RUNTIME CERTIFICATION PENDING`.
- V3-10C4: `NOT STARTED — PREPARATION AUDIT COMPLETE`.
- V3-10C5: `NOT STARTED — PREPARATION ONLY`.
- Product files changed in this preparation slice: `0`.
- Authenticated runtime and rendered responsive PASS claims: `PENDING`.

The audit covers the V3 Services/Jobs, Service Workspace and Work Report
surfaces, Alerts, Closings and Recurring Plans, plus the shared search,
filter, status, sheet, relation, loading, error and navigation surfaces they
consume.

## 2. Architecture inventory

### Services / Jobs

| Concern | Current evidence |
| --- | --- |
| V3 page/list | `src/v3/jobs/V3JobsPage.tsx` and `V3JobRow.tsx`; mounted by `src/pages/JobsPage.tsx` when `v3Mode` is active. |
| Workspace | `src/v3/jobs/V3JobWorkspace.tsx`; list-to-workspace transition is a full-screen V3 branch with `job` deep-link state and Back scroll restoration. |
| Create/edit | `V3JobCreateFlow.tsx` for V3 create; workspace edit form in `V3JobWorkspace.tsx`; legacy-compatible flows remain in `src/features/jobs/JobCreateFlow.tsx`, `JobCreateForm.tsx` and `JobDetailCard.tsx`. |
| Search/filter | V3 local search covers display code, billing concept, service type, client and property labels/codes, plus scheduled date. Tabs are Hoy, Próximos, Completados, Todos and Archivados. |
| Selection/bulk | No V3 bulk selection is exposed in the inspected V3 page. Duplicate review is available through `DuplicateReviewOverlay` in the page wrapper. |
| Write/status layer | `src/features/jobs/jobWriteApi.ts` (`saveJobWithLines`); status update uses `operationalWriteRpcPaths.updateJobStatus`; lifecycle archive uses `patchLifecycleEntity`. |
| Duplicate/Invoice guard | `findJobDuplicateGroups` consumers in the create/page flow; `canCreateInvoiceFromJob` in `src/features/jobs/jobInvoiceEligibility.ts`. |
| Tests | `jobWriteApi.test.ts`, `jobInvoiceEligibility.test.ts`, `jobOperationalState.test.ts`, `jobEditableLines.test.ts`, `jobEditorLiveState.test.ts`, `jobWorkReport.test.ts` and duplicate coverage. |
| Styling | `src/features/jobs/jobsOperations.css` plus shared V3 primitives and semantic tokens. |

The current operational status model is `pending`, `scheduled`,
`in_progress`, `completed`, `review` (derived when overdue) and `cancelled`.
Persisted status transitions exposed by the V3 editor are Pendiente,
Programado, En curso, Realizado and Cancelado. Archive/delete are lifecycle
flags, not replacement status values.

### Service Workspace and Work Report

- The workspace exposes identity/code, date, operational status, billing
  status/amount, operational notes, client/property/quote/invoice relations,
  timeline and document actions.
- Primary action is conditional: create invoice only when
  `canCreateInvoiceFromJob` allows it; otherwise open the existing invoice or
  edit the service. This is the protected duplicate-safety seam.
- Edit persistence is `saveJobWithLines`, followed by the status RPC when the
  status changed. Cancellation is confirmed before persistence; archiving is
  routed through the lifecycle API.
- `src/v3/jobs/jobWorkReport.tsx` builds a browser-side A4 PDF from the current
  job, client, property, quote, invoice and related payments. It uses
  `html2canvas` and `jspdf`; `V3JobWorkspace` delivers or shares the file.
  The output explicitly states that it is an operational summary and not a
  certificate of execution, signature or geolocation.
- Current Work Report test coverage only asserts safe filename construction.
  PDF rendering and mobile document-action ergonomics remain runtime work.

### Alerts

| Concern | Current evidence |
| --- | --- |
| V3 page | `src/v3/alerts/V3AlertsPage.tsx`, mounted from `src/app/AppShell.tsx`. |
| Source/rules | `src/features/automation/alertRules.ts`; current rule IDs cover intake drafts, unpaid invoices, completed jobs without invoice, accepted quotes without job, missing expense support, expense fiscal review, quarter reminder and recurring plan due. |
| Presentation | `src/features/automation/alertPresentation.ts` groups critical, action, follow-up and informational buckets; V3 page currently filters pending, critical, reviewed and all. |
| Decision/state API | `src/features/alerts/alertDecisionApi.ts`; `AlertDecisionStatus` is `open`, `acknowledged`, `resolved` or `dismissed`, with global and user scopes. |
| Actions | AppShell handlers persist read/acknowledge/dismiss/reopen decisions; V3 detail sheet exposes the rule-specific primary action, read, acknowledge/dismiss where valid and reopen for resolved/dismissed records. |
| Tests | `alertPresentation.test.ts` and the existing automation/alert integration coverage. |

The state machine is not a visual priority system: severity comes from the
rule (`critical`, `warning`, `info`) and lifecycle comes from the decision.
Future UI must not collapse those meanings or invent snooze/resolve behavior.

### Closings

- V3 surface: `src/v3/closing/V3ClosingPage.tsx`.
- Calculation contract: `buildClosingSummary` in
  `src/features/closing/closingSummaryEngine.ts`, backed by
  `closingDeterministicSummary`, fiscal-period resolution, VAT summary and
  stored quarterly/annual summaries.
- Inputs are existing invoices, payments, expenses, quotes, jobs and stored
  quarterly/annual summaries. The engine filters by the selected period and
  derives totals, outstanding, incidence counts, document support coverage,
  VAT indicators and readiness.
- Persistence adapters are `src/features/quarterlyClosing/quarterlyClosingApi.ts`
  and `src/features/annualClosing/annualClosingApi.ts`, which upsert snapshots
  by fiscal quarter or fiscal year. V3 exposes explicit period selection,
  incidence navigation, internal notes, snapshot preparation and export.
- `src/features/closingExports/*` provides the existing period package;
  `src/features/closingIntelligence/closingIntelligenceApi.ts` calls the
  assistive summary endpoint. The deterministic summary remains the source
  of truth; the V3 copy explicitly says the output is not an official
  certification and AI does not recalculate or replace professional review.
- Tests include `closingSummaryEngine.test.ts`, fiscal-period, VAT,
  semester-audit and export-policy suites.

### Recurring Plans

- V3 surface: `src/v3/recurring/V3RecurringPlans.tsx`, embedded in the client
  workspace; native component coverage is in `V3RecurringPlans.test.tsx`.
- Shared flow/form contracts remain in
  `src/features/recurringInvoices/RecurringInvoicePlanFlow.tsx` and
  `RecurringInvoicePlanForm.tsx`.
- Persistence: `saveRecurringInvoicePlan` calls the existing
  `save_client_recurring_invoice_plan` RPC. Generation:
  `generateInvoiceFromRecurringPlan` calls
  `generate_invoice_from_recurring_plan` and returns the generated invoice id.
- Mapping: `buildRecurringPlanPersistenceInput` preserves identity, client,
  property/quote relations, status, cadence, next issue date, tax, notes and
  template lines.
- Statuses are exactly `active`, `paused`, `archived`; UI exposes Pausar,
  Reanudar and Archivar behind confirmation. Invoice default status is exactly
  `draft` or `issued`.
- Cadences are exactly `weekly`, `biweekly`, `monthly`, `quarterly`, mapped by
  `getRecurringFrequencyLabel` and advanced by
  `calculateNextRecurringIssueDate`. `isRecurringPlanDue` compares the next
  issue date to today.
- `findRecurringPlanDuplicateGroups` gates create/edit before the persistence
  RPC and opens `V3DuplicateReviewSheet`. The flow has dirty-state callbacks,
  client-scoped property/quote options and optional creation of related
  property/quote records through existing flows.
- Tests include `planPersistence.test.ts`, `recurringInvoiceSchedule.test.ts`
  and V3 native rendering coverage.

## 3. Protected contract map

| Contract | Exact evidence | C5 rule |
| --- | --- | --- |
| Service persistence | `src/features/jobs/jobWriteApi.ts`; `saveJobWithLines` and `operationalWriteRpcPaths` | Preserve payload/RPC and line replacement semantics. |
| Service status | `V3JobWorkspace.tsx`, `JobDetailCard.tsx`, `jobOperationalState.ts` | Preserve status values, cancellation confirmation and derived overdue review. |
| Service → invoice | `src/features/jobs/jobInvoiceEligibility.ts`; `canCreateInvoiceFromJob` | Completed, non-archived/non-deleted/non-cancelled only; reject any active invoice linked by `job_id` or `invoice_id`. |
| Service duplicates | `src/features/duplicates/duplicateEngine`, `findJobDuplicateGroups` | Keep review/ignore/reopen behavior and do not bypass it. |
| Work Report | `src/v3/jobs/jobWorkReport.tsx` | Keep this operational PDF/share path; no new document engine, signature, GPS or certification claim. |
| Alert state | `src/features/alerts/alertDecisionApi.ts`, `AppShell.tsx` handlers | Preserve open/acknowledged/resolved/dismissed and global/user scope. |
| Closing calculation | `buildClosingSummary` and deterministic summary engine | Never replace deterministic financial values with AI or visual state. |
| Closing persistence | `quarterlyClosingApi.ts`, `annualClosingApi.ts` | Keep period keys, snapshots and existing save contract. |
| Recurring persistence | `saveRecurringInvoicePlan`, `buildRecurringPlanPersistenceInput` | Preserve fields and status transitions. |
| Recurring generation | `generateInvoiceFromRecurringPlan` and schedule helpers | Preserve duplicate protection, cadence and returned invoice relation. |

## 4. Current UX and state audit

### Services / Jobs

Current strengths: the V3 list makes today/upcoming/completed counts
visible, supports operational search, has a bounded create CTA, labels client
and property relations, and keeps the workspace separate from the list. The
workspace puts status, billing relation and next action near the top and
offers a clear Back path and deep-link restoration.

Preparation findings:

- `O-C5-P2`: list hierarchy has three KPI blocks, search, duplicate review and
  five filter tabs before rows. On small screens this may push the first
  actionable service below the fold; runtime evidence is required before any
  change.
- `O-C5-P2`: a row contains concept, client/property, date, status, billing
  status and amount. This is useful but dense; C5 should test whether billing
  state and operational state remain distinguishable at 320/390 px.
- `O-C5-P2`: the workspace primary label changes between Crear factura, Ver
  factura and Editar servicio. The contract is safe, but later UI should make
  the reason for each branch explicit without adding another action.
- `O-C5-P3`: the row fallback can display an id when a human label is missing
  (`client_id`, `property_id`, or `job.id` in accessible fallback text). This
  should be reviewed in the runtime privacy/UUID gate; no replacement is
  invented in this preparation slice.
- `O-C5-P3`: Work Report actions are secondary actions in a document section;
  their loading, share fallback and long-content behavior need authenticated
  viewport evidence.

Static states present: populated, empty/search miss, error, duplicate review,
create dirty, edit dirty, completed/not invoice-eligible, invoice-eligible,
cancel confirmation, archived and document failure/success status.

### Alerts

Current strengths: rule-specific summaries carry counts, amount/age context
and routing; critical/warning/info semantics are preserved; reviewed items can
be reopened; primary action labels are rule-aware.

Preparation findings:

- `O-C5-P2`: the V3 page shows pending/critical/reviewed/all filters but does
  not render the four presentation buckets from `alertPresentation.ts` as
  sections. The later composition slice should verify whether urgency is
  obvious without changing severity or lifecycle.
- `O-C5-P2`: the detail sheet can expose several equal-looking actions. The
  future hierarchy should keep the rule-specific route primary and lifecycle
  decisions secondary.
- `O-C5-P3`: date/time and source context are not first-class row fields in
  `V3AlertsPage`; they are available through detail/rule payloads only where a
  rule supplies them. Do not invent timestamps.

Static states present: empty filter, pending, acknowledged, resolved,
dismissed, read/unread, routing action and action error through the parent
handlers. Authenticated runtime is required for persistence and reload proof.

### Closings

Current strengths: period selection precedes the deterministic KPIs; readiness
and incidences are visible; incidences route back to the relevant module;
snapshot, export and AI actions have separate feedback; AI copy is explicitly
assistive.

Preparation findings:

- `O-C5-P1`: the screen contains financial snapshot preparation, export and
  assistive AI actions in one page. C5 must preserve the visual distinction
  between calculated source values, persisted snapshot state and AI prose.
- `O-C5-P2`: period selector, three KPI values, incidents, notes, export and AI
  actions form a long linear page. Tablet/mobile runtime must verify that the
  readiness decision and primary next action are not buried.
- `O-C5-P3`: the current copy uses a broad “Salida del periodo” section for
  export and AI. Later refinement should give each output a concise purpose,
  without altering exports or the intelligence endpoint.

Static states present: quarter/year/month/custom selection, ready/review/
blocked readiness, no incidences, incidences, unsaved notes, snapshot save,
export success/failure, AI success/fallback and missing summary/error.

### Recurring Plans

Current strengths: client-scoped plans show amount, cadence, next emission and
status; workspace shows relation, template lines, tax-inclusive estimate and
the protected generation action; status changes require confirmation; create/
edit has dirty callbacks and duplicate review.

Preparation findings:

- `O-C5-P2`: creation combines client context, relation selectors, line
  editing, cadence, next date, invoice state, notes and internal notes in a
  sheet/flow. Runtime is needed to determine whether mobile review and primary
  save remain reachable without changing fields.
- `O-C5-P2`: “Generar factura” is disabled unless the plan is active, but the
  reason is not surfaced in the workspace. Later UX may explain the existing
  guard without changing generation semantics.
- `O-C5-P3`: cadence, next date, due state, default invoice state and status
  are spread across summary/row/workspace. A consistent scan order should be
  planned, not a new data model.

Static states present: empty/populated, active/paused/archived, due/not due,
draft/issued default invoice, create/edit dirty, invalid required fields,
duplicate review, save error, status confirmation and generation error/success.

## 5. Relationship map

- Service ↔ Client and Service ↔ Property are selected in create and exposed
  as human-readable workspace links.
- Service ↔ Quote is available for accepted quote context; Service ↔ Invoice
  is exposed when linked, with the invoice eligibility guard controlling the
  create action; related Payments feed the workspace financial summary.
- Work Report consumes the same client/property/quote/invoice/payment
  relations and must remain a summary, not a new authoritative record.
- Alert items route to a view/module or quarterly closing using typed routing;
  their fingerprint and decision key identify the rule instance.
- Closing summaries aggregate period-scoped invoices, payments, expenses,
  quotes and jobs; incidence links route to existing modules.
- Recurring Plans belong to Client and may reference Property and Quote;
  generation produces an Invoice id through the existing RPC.

All future displays must continue to use display codes/labels and relation
helpers. Raw UUIDs are not a valid user-facing relationship design.

## 6. Search, filters, selection and flows

| Module | Existing capability | Future presentation only | New functionality out of scope |
| --- | --- | --- | --- |
| Services | Local search; today/upcoming/completed/all/archived tabs; duplicate review | Compact search/filter order, row scan rhythm, clear invoice eligibility | Server search, new status, bulk service actions |
| Alerts | pending/critical/reviewed/all; rule routing; lifecycle actions | Stronger priority grouping and detail action order | New severity, snooze, new lifecycle |
| Closings | period mode/year/quarter; incidence navigation; snapshot/export/AI actions | Source-vs-output hierarchy and responsive composition | New fiscal calculations or AI authority |
| Recurring | Client-scoped list; create/edit; duplicate review; status confirmation; due detection | Review order, due/status explanation and mobile sheet composition | New cadence, scheduler, generation rule |

Create/edit audits show required client/property/date/status/context/line
fields for Services and client/title/relation/lines/cadence/date/tax/status/
notes for Recurring. Both expose dirty callbacks or parent dirty handling;
future runtime must verify cancel/Back guards and validation feedback. Alerts
and Closings only edit decisions/notes/snapshots through their existing
contracts.

## 7. Accessibility and responsive source audit

Static checks found semantic buttons for relation/action controls, labelled
V3 fields/search, `role="tablist"`/`aria-selected` for job filters, status
text alongside tones, `role="alert"`/`role="status"` feedback and shared V3
primitive usage. The certified 44px contract remains a C2/C1 dependency.

Items for C5 runtime review:

- tab/button groups and job filter tabs at 320/390 may wrap or create excess
  first-viewport height;
- job and recurring action groups may wrap in narrow sheets;
- closing selector/KPI/incident rows may create long linear scroll at mobile;
- Work Report buttons and generated content need keyboard/focus and fallback
  review;
- alert sheet action order and status announcements need keyboard and screen
  reader replay;
- date, amount and status labels need accessible-name checks at every surface;
- 1024 tablet and 1280 desktop require explicit review for sparse or squeezed
  layouts rather than a desktop-only assumption.

No rendered responsive PASS is claimed here. Required future viewport set:
`320x568`, `390x844`, `430x932`, `768x1024`, `1024x1366`, `1280x800`,
`1440x900`, `1920x1080`.

## 8. C2 compliance and debt classification

Operations surfaces consume C2 V3 primitives (`V3Page`, page titles, fields,
entity lists, status, sheets, summaries and action hierarchy), but the
following module-specific drift is recorded for C5 rather than reopening C2:

- some list pages put KPI/summary blocks before the primary operational scan;
- action groups can contain several peer secondary actions;
- status, due date and financial context are not always arranged in one
  consistent row/workspace rhythm;
- long form and closing surfaces need responsive density evidence;
- fallback relation values require a runtime privacy/UUID check.

### Severity summary

`O-C5-P1`:

1. Closing screen must keep deterministic source values, persisted snapshot
   state and AI assistive prose unmistakably separate.

`O-C5-P2`:

1. Services list/workspace hierarchy and first actionable item on mobile.
2. Alert priority/detail action order.
3. Closing page length and decision visibility.
4. Recurring create/review density and disabled generation explanation.

`O-C5-P3`:

1. Relation/status/date scan consistency across operations rows.
2. Work Report document-action and fallback polish.
3. Closing output section copy/label clarity.

No product change is authorized by this list. No new status, entity,
calculation, scheduler behavior, AI authority, or relation was proposed.

## 9. Future authenticated runtime matrix

For each of Services, Service Workspace, Work Report, Alerts, Closings and
Recurring Plans, replay the following at all eight viewports:

1. populated, empty and loading/error states where QA data permits;
2. search/filter match, miss and clear where supported;
3. list → workspace → Back, deep link and hard reload;
4. status-disabled/terminal action behavior;
5. human-readable relationship navigation;
6. Work Report download/share fallback;
7. closing period selection, readiness, snapshot/export and AI assistive
   boundary;
8. recurring due/not-due, active/paused/archived, duplicate review and
   generated/not-generated invoice state.

Runtime invariants: production requests `0`, QA mutations `0` unless a later
prompt explicitly authorizes exact fixtures, console/page errors `0`, critical
failed requests `0`, horizontal overflow `0`, broken images `0`, visible or
accessible UUID `0`, Unicode-as-icon `0`, legacy markers `0`.

## 10. C5 closure boundary

C5 product implementation may start only after C3 authenticated runtime is
closed and a separate implementation prompt authorizes it. This preparation
audit does not start C5, does not certify C3, and does not claim any rendered
runtime result.

## 11. C5.1 disposition — 2026-09-17

The later C3 and C4 closure gates are complete, and an explicit C5.1
authorization permitted only the shared operational hierarchy/status batch.
Its evidence is recorded in `docs/V3-10C5-1_SHARED_OPERATIONS_HIERARCHY.md`.

| Finding | C5.1 disposition |
| --- | --- |
| O-C5-P3: relation/status/date scan consistency across operational rows | `FIXED` for the C5.1 shared presentation boundary: Services distinguishes service and billing state, Alerts distinguishes priority and decision state, Recurring distinguishes plan and emission state, and Cierres labels preparation readiness. |
| O-C5-P3: Services raw relation fallback | `FIXED`: missing labels now render human-safe context; no technical ID is rendered or used in the accessible row name. |
| O-C5-P2: Services list/workspace hierarchy | `PARTIALLY FIXED`: the shared row/status order and filter target are corrected. KPI/search/filter order and workspace branch clarity remain C5.2. |
| O-C5-P2/P3 for Alerts, Cierres, Recurring and Work Report | `STILL OPEN` in their assigned C5.2–C5.5 batches. C5.1 does not close their module-specific composition or business-safety findings. |

## 12. C5.2 disposition — 2026-09-17

The authorized C5.2 batch covers Services/Jobs, Service Workspace and the
existing Work Report only. Its implementation and runtime evidence are
recorded in `docs/V3-10C5-2_SERVICES_WORKSPACE_WORK_REPORT.md`.

| Finding | C5.2 disposition |
| --- | --- |
| O-C5-P2: Services list hierarchy and first actionable item | `FIXED`: search/filter and the primary create path lead; supporting KPIs move below the operational list. |
| O-C5-P2: Service Workspace invoice branch clarity | `FIXED`: existing eligibility remains the only decision and the next-action explanation is explicit. |
| O-C5-P3: Services technical identifier fallback | `FIXED`: rows, accessible labels and Work Report output use human-safe wording. |
| O-C5-P3: Work Report action/loading/fallback polish | `FIXED`: download/share feedback is contextual and non-blocking while the output remains operational only. |
| Alerts, Closings, Recurring findings | `STILL OPEN`: no C5.3+ scope was started. |
