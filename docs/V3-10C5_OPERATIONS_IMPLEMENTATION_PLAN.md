# V3-10C5P — OPERATIONS IMPLEMENTATION PLAN

Status: `C5.1 CLOSED / CERTIFIED / C5.2–C5.6 NOT STARTED`

Parent gate: C3 must first become `CLOSED / CERTIFIED`. C4 remains
`NOT STARTED / PREPARATION AUDIT COMPLETE`. No batch below is authorized by
this document alone.

## 1. Dependency and freeze rules

- Keep `saveJobWithLines`, `operationalWriteRpcPaths.updateJobStatus`,
  `canCreateInvoiceFromJob`, duplicate review, Work Report generation,
  alert decision states, `buildClosingSummary`, closing snapshot APIs,
  recurring persistence, schedule helpers and generation RPCs unchanged in
  meaning.
- No schema, RPC, policy, bucket, query-contract or route changes.
- No new service entity, status, alert severity, fiscal calculation,
  reconciliation state, cadence or AI authority.
- Do not use QA writes in the preparation or implementation batches unless a
  later gate explicitly defines exact fixtures and cleanup.
- Every implementation batch requires independent review; the implementer
  cannot self-certify.

## 2. Bounded batches

### C5.1 — Shared operations hierarchy and status conventions

Status: `CLOSED / CERTIFIED`

Likely files: `src/v3/components/V3Primitives.tsx`, operations-specific V3
styles, `src/v3/jobs/V3JobRow.tsx`, `V3AlertsPage.tsx`,
`V3RecurringPlans.tsx`, `V3ClosingPage.tsx` and semantic token consumers only
where a concrete operations regression is demonstrated.

Scope:

- establish one compact row order for identity, context, status, date/value
  and action;
- keep primary action singular and lifecycle actions secondary;
- distinguish severity, lifecycle, readiness and due state without changing
  their values;
- preserve the C2 spacing, typography, surface, sheet, navigation and 44px
  contracts.

Tests: shared heading/action/status semantics, 44px target regression, no raw
UUID in labels, row empty/error/loading rendering and no C2 token drift.

Risk: global-looking primitive changes can regress finance/CRM; limit changes
to an operations consumer or prove all affected consumers.

Certified implementation:

- Optional contextual labels in `V3EntityStatus` distinguish the type of a
  status without adding an operational value or transition.
- Services, Alerts, Recurring Plans and Cierres now use the compact
  identity/context/status/date-or-value ordering where the existing surface
  exposes those facts.
- Services no longer falls back to `id`, `client_id` or `property_id` in its
  rendered or accessible row label; missing human context is explicit instead.
- Filter tabs retain their compact scrollable presentation while their hit area
  is at least the existing `--v3-touch-min` 44px contract.
- C5.1 did not change a workspace flow, Work Report, alert decision action,
  closing output, recurring persistence/generation behavior or any protected
  contract. Those remain in their assigned later batches.

Evidence: `docs/V3-10C5-1_SHARED_OPERATIONS_HIERARCHY.md`.

### C5.2 — Services, Service Workspace and Work Report

Likely files: `src/v3/jobs/V3JobsPage.tsx`, `V3JobRow.tsx`,
`V3JobWorkspace.tsx`, `V3JobCreateFlow.tsx`, `jobWorkReport.tsx` and
`src/features/jobs/*` tests only for presentation contracts.

Scope:

- improve operational scan order and mobile first action;
- make the existing status and invoice-eligibility branch legible;
- preserve client/property/quote/invoice/payment navigation;
- improve Work Report action hierarchy and error/status feedback without
  creating a second document engine or execution certificate.

Tests: job status guard, duplicate review, service→invoice eligibility and
existing-invoice branch, relation labels, deep link/Back, dirty cancel,
report filename/output contract, share/download fallback, accessibility and
8-view runtime.

Risk: high business safety around duplicate invoicing. Dependency: C5.1 and
the existing `jobInvoiceEligibility` tests must remain green.

### C5.3 — Alerts

Likely files: `src/v3/alerts/V3AlertsPage.tsx`,
`src/features/automation/alertPresentation.ts`,
`src/features/alerts/alertActionRegistry.ts` and focused presentation tests.

Scope:

- make existing critical/action/follow-up/info meaning scannable;
- keep rule-specific primary routing dominant;
- keep acknowledge/dismiss/reopen/read semantics and global/user scope;
- provide clear empty/reviewed feedback without inventing severity or
  snooze.

Tests: every current rule routing label, severity/lifecycle separation,
reopen, empty filter, accessible sheet action order and read-only runtime
navigation. Any persistence test must use the existing contract and an
explicitly authorized QA gate.

Risk: changing action labels can imply unsupported transitions. Dependency:
alert state-machine tests and AppShell handlers.

### C5.4 — Closings

Likely files: `src/v3/closing/V3ClosingPage.tsx`, shared closing presentation
components, closing export UI and focused tests; do not rewrite
`closingSummaryEngine.ts`.

Scope:

- make period, deterministic KPIs, readiness/incidences, snapshot, export
  and assistive AI visibly separate;
- keep incidence navigation and exact save/export contracts;
- improve mobile/tablet decision visibility and output copy.

Tests: `buildClosingSummary` regression, period/incidence routing, readiness
states, snapshot mapping, export package policy, AI input provenance and
assistive-only copy, plus 8-view runtime.

Risk: very high if presentation changes obscure source-of-truth values.
Dependency: deterministic summary and quarterly/annual API tests.

### C5.5 — Recurring Plans

Likely files: `src/v3/recurring/V3RecurringPlans.tsx`,
`src/features/recurringInvoices/RecurringInvoicePlanFlow.tsx`,
`RecurringInvoicePlanForm.tsx`, shared relation/status styles and tests.

Scope:

- improve plan identity/cadence/next emission/amount/status scan;
- explain due and disabled generation using existing data only;
- preserve active/paused/archived confirmation, dirty state, duplicate review,
  related property/quote filtering and generation RPC.

Tests: all four cadence helpers, status mapping/pause/resume/archive,
duplicate review, persistence-input mapping, default invoice state, due state,
dirty/cancel, relation labels and generated invoice routing.

Risk: generation duplicates and status semantics. Dependency: existing
`planPersistence`, schedule, duplicate-engine and RPC-wrapper tests.

### C5.6 — Cross-module runtime and responsive certification

Surfaces: Services, Service Workspace, Work Report, Alerts, Closings and
Recurring Plans at `320x568`, `390x844`, `430x932`, `768x1024`, `1024x1366`,
`1280x800`, `1440x900`, `1920x1080`.

Required evidence:

- list/workspace/Back/deep-link/hard-reload;
- search/filter/empty/error states;
- status-disabled and terminal actions;
- relations use human-readable labels;
- Work Report download/share fallback;
- closing readiness/source-vs-AI boundary;
- recurring due, pause/resume/archive, duplicate review and generated/not
  generated states;
- production requests `0`, QA mutations `0` unless explicitly authorized,
  console/page errors `0`, critical failed requests `0`, overflow `0`, broken
  images `0`, UUID `0`, Unicode-as-icon `0`, legacy markers `0`;
- accessibility: heading order, labels, focus, keyboard, 44px targets,
  status announcements and sheet/dialog semantics.

Independent `pr-quality-gate` must review source diff and evidence after the
runtime run. C5 cannot close on static tests alone.

## 3. Test matrix by protected contract

| Contract | Required regression before closure |
| --- | --- |
| Service persistence/status | create/edit line payload, status RPC path, cancellation confirmation, archive lifecycle, refresh state |
| Service → invoice | completed eligibility, cancelled/archived rejection, existing invoice rejection, primary-action branch |
| Work Report | filename sanitization, relation labels, PDF/share/download errors and operational disclaimer |
| Alerts | rule routing, severity bucket, lifecycle state, read scope, acknowledge/dismiss/reopen |
| Closings | deterministic summary values, readiness/incidences, period filtering, snapshot mapping, export payload, AI assistive boundary |
| Recurring | persistence input, all cadences, due date, active/paused/archived, duplicate review, default invoice state, generation invoice relation |

## 4. Exit criteria

A future C5 close requires all of the following:

1. C3 authenticated runtime certification is already closed.
2. Each bounded batch has an independent review and no protected contract
   change.
3. Component/integration tests and the full suite pass with no regression.
4. `npm run lint`, `npm run build` and `git diff --check` pass.
5. Authenticated runtime matrix passes at all eight viewports with the
   invariants in C5.6.
6. No unapproved QA/production writes, schema/RPC/policy/bucket changes or
   private evidence are committed.
7. Documentation records exact findings, evidence, remaining debt and the
   final commit/push.

Until these criteria are met, the truthful state remains:

`V3-10C5 NOT STARTED — PREPARATION COMPLETE`
`V3-10C3 OPEN — AUTHENTICATED RUNTIME CERTIFICATION PENDING`
