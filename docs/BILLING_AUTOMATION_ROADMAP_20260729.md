# Costa Clean Billing Automation Roadmap

## STATUS

`READY_FOR_SPRINT_0_AUDIT`

Created: 2026-07-29

This is a new scoped roadmap opened after the closure of `docs/APP_TRANSFORMATION_ROADMAP.md`. It governs billing automation, invoice reuse, concept suggestions, billable-service control, client billing profiles, deterministic draft generation, document traceability and related QA.

No production, remote Supabase, migration, RLS, Auth, Storage, fiscal emission or deployment action is authorized by this document.

## OBJECTIVE

Turn the existing Costa Clean finance ecosystem into a fast, deterministic, auditable and scalable billing workflow where staff can:

- create a safe new draft from a previous invoice;
- reuse only valid commercial data;
- find line concepts by typing instead of browsing long lists;
- identify completed services that are still billable;
- prevent duplicate billing;
- store client-specific billing preferences;
- generate recurring or event-driven drafts for human review;
- preserve fiscal numbering, snapshots, payments, PDFs and audit evidence;
- see consistent creation date and time across operational entities.

## BUSINESS CONTEXT

Costa Clean manages clients, properties, quotes, jobs/services, recurring work, invoices, payments, income, expenses and fiscal closeout in one React/TypeScript/Supabase application.

The target experience must remain:

- minimalist and mobile-first;
- one main reading and one dominant next action per workspace;
- StepFlow-based for risky or high-friction flows;
- deterministic for money, tax, numbering and status transitions;
- honest about failed writes and zero-row mutations;
- safe under RLS and authenticated user boundaries;
- review-first before any irreversible fiscal emission or external send.

## CURRENT STATE VERIFIED BEFORE THIS ROADMAP

The roadmap starts from the real implementation, not from a greenfield assumption.

### Existing invoice reuse entry point

`src/features/invoices/InvoiceDetailCard.tsx` already exposes an optional `onCreateSimilarInvoice` callback and the visible action `Crear factura como esta`.

This means the product already has a partial invoice-reuse entry point. Sprint 0 must trace its full handler, prefill construction, create flow, persisted payload and tests before changing behavior.

### Existing invoice prefill model

`src/features/invoices/invoiceCreatePrefill.ts` currently supports origin kinds:

- `job`
- `quote`
- `manual`
- `recurring`

It does not currently express an explicit `invoice` origin in the verified type. Sprint 0 must determine whether invoice reuse is mapped to another origin, handled outside this model or missing provenance.

### Existing guarded invoice write path

`src/features/financial/financialWriteApi.ts` already:

- routes invoice + line persistence through `save_invoice_with_lines_v2`, with a controlled fallback;
- removes `invoice_number` and `display_code` from browser-authored payloads;
- requires a single confirmed saved invoice result or performs readback;
- checks persisted numbering against expected numbering metadata;
- records invoice audit events.

This foundation must be reused and hardened rather than bypassed.

### Existing fiscal and numbering protections

The invoice detail workspace already includes:

- fiscal snapshot completeness checks;
- blocking before emission when client fiscal data is incomplete;
- numbering gap audit;
- draft-safe behavior where a draft does not consume a definitive fiscal number;
- payment-state and cancellation handling;
- archive, restore and draft trash lifecycle actions.

### Existing governance constraints

- `AGENTS.md`, `docs/UX_APP_MANUAL.md`, `docs/CODEX_WORKFLOW.md`, `docs/APP_QUALITY_GATES.md` and `docs/APP_TRANSFORMATION_ROADMAP.md` remain mandatory.
- `supabase db push` remains locked.
- Any schema, RLS, RPC, migration or remote QA action requires its own exact gate and authorization.
- Every closed implementation block must pass the repository validations, produce a reviewable commit and be pushed.
- The implementer never approves its own work.

## TARGET STATE

### A. Create a safe draft from a previous invoice

From an invoice detail workspace, staff can select `Crear factura similar` and receive a new editable draft that may reuse:

- client;
- property when still valid;
- billing address/fiscal snapshot source rules;
- line concepts;
- quantities;
- units;
- unit prices;
- discounts only when supported by the current data contract;
- payment terms;
- notes and language when appropriate;
- document template preference;
- client billing defaults.

The new draft must never copy as definitive state:

- invoice ID;
- display code;
- fiscal invoice number;
- original creation timestamp;
- original issue date;
- original due date without recalculation;
- emitted/sent/paid/cancelled status;
- payments or income records;
- original PDF or immutable document version;
- unique bank references;
- accounting closeout links;
- original audit identity;
- previous service-to-invoice ownership unless explicitly selected and eligible.

The source invoice must remain unchanged.

### B. Explicit provenance

The new draft must have queryable provenance without weakening fiscal boundaries. Sprint 0 must choose the smallest compatible option after inspecting existing audit/event and metadata contracts:

1. use existing audit metadata;
2. use existing `pricing_metadata`/write trace metadata;
3. extend the prefill origin contract;
4. add a dedicated nullable relation only if the current architecture cannot express provenance safely.

No schema change is assumed.

### C. Contextual concept suggestions

Line concept fields in invoices, quotes, services and recurring billing should remain visually empty until the user types.

Suggestions should rank, in order defined by verified product rules:

- text match;
- concepts previously used for the selected client;
- concepts previously used for the selected property;
- recent concepts;
- frequent concepts;
- active service catalog entries;
- compatible quote, invoice or recurring lines.

The component must support keyboard, pointer and mobile input, debounce, result limits, loading, empty, error, creation of a new concept and duplicate prevention.

### D. Billable-service control

The app must clearly distinguish:

- completed and unbilled;
- partially billed;
- billed;
- excluded from billing;
- cancelled/archived/non-eligible;
- disputed or correction-required when such states exist.

No service line may be silently billed twice. Concurrency and retry behavior must be deterministic.

### E. Client billing profiles

A verified client billing contract may hold defaults such as:

- preferred property;
- recurring concepts and prices;
- payment terms;
- billing day and cadence;
- language;
- billing email;
- delivery preference;
- notes;
- document template;
- automation enabled/disabled;
- grouping rule by client/property/service period.

The data location must be selected only after auditing existing client, recurring and metadata structures.

### F. Draft automation, never blind emission

Automation may create or propose drafts after deterministic eligibility checks. It may not automatically emit, send or mark payment without an explicit approved policy and separate gate.

## IN SCOPE

- invoice reuse audit and hardening;
- invoice prefill/provenance contract;
- created-at display standardization;
- reusable contextual concept suggestion architecture;
- completed/unbilled service visibility and duplicate prevention;
- client billing profiles;
- recurring/event-driven draft generation;
- audit trail and activity visibility;
- PDF/document versioning analysis and hardening;
- email/WhatsApp handoff design after human review;
- deterministic states, amounts, numbering and idempotency tests;
- mobile, tablet, keyboard and accessibility QA;
- documentation and release gates.

## OUT OF SCOPE WITHOUT A SEPARATE GATE

- production Supabase writes;
- applying migrations or repairing migration history;
- disabling or weakening RLS;
- using `service_role` in browser code;
- autonomous fiscal emission;
- autonomous payment reconciliation based only on AI interpretation;
- changing tax rates, prices or commercial policy without explicit approval;
- rewriting the finance module;
- replacing the current design system or StepFlow;
- changing client portal tenancy or Auth boundaries;
- deploying to production;
- legal or tax certification.

## ARCHITECTURE DECISIONS

1. Reuse current invoice write APIs and RPC boundaries.
2. Keep browser payloads unable to choose definitive invoice numbering.
3. Treat draft creation and fiscal emission as separate transitions.
4. Prefer existing audit/metadata structures before new columns or tables.
5. Keep monetary calculations deterministic and testable.
6. Use one shared concept-suggestion contract across modules.
7. Use bounded server-side queries when dataset growth makes full client download unsafe.
8. Require idempotency for service-to-invoice linking and recurring generation.
9. Keep automation explainable: eligibility input, decision, output and failure must be auditable.
10. Keep every sprint independently reviewable and reversible.

## AGENT OPERATING MODEL

All agents are manually selected and remain subordinate to `AGENTS.md`.

| Responsibility | Primary agent | Independent support/gate |
|---|---|---|
| Continue and orient the roadmap | `project-continuation` | `documentation-roadmap` |
| Audit and plan each sprint | `implementation-planner` | `supabase-guardian`, `business-rules-test-engineer` as read-only specialists |
| Implement approved frontend/full-stack slices | `senior-fullstack-builder` | `frontend-ux-accessibility`, `qa-e2e-specialist` |
| Supabase/RLS/RPC/data contract | `supabase-guardian` | `security-privacy-auditor`, separate human authorization |
| Money, tax, numbering, state and idempotency | `business-rules-test-engineer` | `qa-e2e-specialist` |
| Mobile UX, StepFlow and accessibility | `frontend-ux-accessibility` | `qa-e2e-specialist` |
| Unit/integration/E2E evidence | `qa-e2e-specialist` | `pr-quality-gate` |
| Security/privacy review | `security-privacy-auditor` | `pr-quality-gate` |
| Documentation and state reconciliation | `documentation-roadmap` | `pr-quality-gate` |
| PR merge decision | `pr-quality-gate` | never the implementer |
| Release readiness | `release-deployment-guardian` | explicit human deployment decision |
| Future backend automation agent architecture | `enterprise-agent-architect` | `security-privacy-auditor`, `business-rules-test-engineer` |

## SPRINTS

### Sprint 0 — Evidence audit and contract map

Status: `READY`

Primary: `implementation-planner`

Supporting specialists: `supabase-guardian`, `business-rules-test-engineer`, `documentation-roadmap`

Objective:

Produce a verified map of the current invoice, quote, job, recurring, payment, income, audit, PDF and created-at flows before product code changes.

Required investigation:

- trace `onCreateSimilarInvoice` from detail action to new invoice persistence;
- identify exactly which fields are copied and reset;
- trace `InvoiceCreatePrefill` consumers and all origin kinds;
- map invoice line sources from jobs, quotes, recurring and manual creation;
- map current concept-history/catalog sources;
- map invoice/job linking and duplicate-billing protections;
- map current created-at fields and display utilities;
- map audit events and document/PDF persistence;
- map current database tables, views, RPCs, triggers, RLS and tests involved;
- identify active client portal work that must remain isolated;
- distinguish verified facts, inferred behavior and open decisions.

Deliverables:

- `docs/billing/BILLING_CURRENT_STATE_AUDIT.md`
- `docs/billing/BILLING_DATA_CONTRACT.md`
- `docs/billing/BILLING_RISK_REGISTER.md`
- updated sprint statuses in this roadmap only when evidence supports them.

Acceptance:

- no product code, schema or runtime changes;
- every claim cites a real file, function, table, RPC, migration or test;
- current reuse behavior is reproducible;
- required first implementation slice is small and explicit;
- no remote writes;
- commit and push completed.

### Sprint 1 — Created-at metadata standardization

Status: `BLOCKED_BY_SPRINT_0`

Primary: `senior-fullstack-builder`

Specialists: `frontend-ux-accessibility`, `qa-e2e-specialist`

Objective:

Standardize creation date/time presentation across clients, properties, leads, quotes, invoices, jobs, payments, income, expenses and recurring entities using existing timestamps.

Acceptance:

- one shared formatter/component contract;
- Europe/Madrid presentation rules documented;
- full date/time on detail views and compact date where appropriate in lists;
- null/invalid historical values handled honestly;
- no new timestamp columns;
- no extra visual cards or list inflation;
- unit tests plus representative mobile QA.

### Sprint 2 — Shared contextual concept suggestions

Status: `BLOCKED_BY_SPRINT_0`

Primary: `senior-fullstack-builder`

Specialists: `frontend-ux-accessibility`, `qa-e2e-specialist`, `business-rules-test-engineer`

Objective:

Replace long always-visible concept lists with a reusable type-to-search suggestion system.

Acceptance:

- shared UI and query/ranking contract;
- starts suggesting only after the configured input threshold;
- bounded results and debounce;
- client/property/recent/frequent context where data exists;
- editable autofill;
- create-new path;
- keyboard and mobile support;
- no duplicate suggestions;
- no unbounded catalogue download;
- quote, invoice and service integrations covered without diverging forks.

### Sprint 3 — Safe create-similar invoice draft

Status: `BLOCKED_BY_SPRINT_0`

Primary: `senior-fullstack-builder`

Specialists: `business-rules-test-engineer`, `supabase-guardian`, `qa-e2e-specialist`

Objective:

Harden the existing `Crear factura como esta` entry point into a fully verified draft-only flow.

Acceptance:

- source invoice remains unchanged;
- new ID and request identity;
- no copied fiscal number, display code, payments, PDF, emitted status or immutable timestamps;
- issue date and due date follow current verified rules;
- client/property/lines/notes copied only by an explicit allowlist;
- provenance recorded through the approved existing or extended contract;
- draft does not consume final numbering;
- write result is verified as exactly one persisted invoice;
- editing the new draft cannot mutate the source;
- retry does not create uncontrolled duplicate drafts;
- audit event identifies source and target without exposing unnecessary data.

### Sprint 4 — Invoice state and payment coherence

Status: `BLOCKED_BY_SPRINT_0`

Primary: `business-rules-test-engineer`

Implementation: `senior-fullstack-builder`

QA: `qa-e2e-specialist`

Objective:

Reconcile administrative invoice status, financial payment status, cancellation, archive and document state without contradictory labels or transitions.

Acceptance:

- explicit state-transition table;
- administrative status is not confused with payment-derived state;
- partial payment, paid, overdue, cancelled and draft edge cases covered;
- numbering and fiscal snapshot gates remain intact;
- no state change reports success without verified persistence;
- correction/reversal paths are documented rather than improvised.

### Sprint 5 — Completed services pending billing

Status: `BLOCKED_BY_SPRINT_0`

Primary: `senior-fullstack-builder`

Specialists: `business-rules-test-engineer`, `supabase-guardian`, `qa-e2e-specialist`, `security-privacy-auditor`

Objective:

Create a clear operational reading of completed services that are eligible, partially billed, billed or excluded.

Acceptance:

- eligibility contract is deterministic;
- invoice creation can select only eligible service lines;
- service-to-invoice association is traceable;
- duplicate billing is rejected at the safest verified layer;
- concurrency and retry tests exist;
- partial billing is either implemented with an explicit allocation model or declared out of scope;
- existing job, quote and invoice relationships remain compatible.

Any required database enforcement must be prepared in source first and cannot be remotely applied without a separate exact gate.

### Sprint 6 — Client billing profiles

Status: `BLOCKED_BY_SPRINT_0`

Primary: `senior-fullstack-builder`

Specialists: `supabase-guardian`, `business-rules-test-engineer`, `frontend-ux-accessibility`

Objective:

Provide a compact client-level billing configuration without duplicating existing recurring or client data.

Acceptance:

- verified storage location and ownership;
- clear defaults versus per-invoice overrides;
- cadence, terms, language, delivery and grouping rules are typed and validated;
- no automatic emission;
- changes are audited;
- mobile UI remains compact and secondary to the client’s primary operational actions.

### Sprint 7 — Deterministic recurring draft generation

Status: `BLOCKED_BY_SPRINTS_5_AND_6`

Primary: `senior-fullstack-builder`

Specialists: `business-rules-test-engineer`, `supabase-guardian`, `enterprise-agent-architect`, `qa-e2e-specialist`

Objective:

Generate reviewable invoice drafts from recurring profiles or completed billable services using deterministic rules.

Acceptance:

- idempotency key per client/property/period/source set;
- repeated execution cannot silently duplicate a draft;
- eligibility and exclusions are visible;
- generated draft records its source inputs and rule version;
- failure is retryable and auditable;
- no emit/send/payment action occurs automatically;
- AI is not used for monetary calculation or final eligibility.

### Sprint 8 — Audit trail and activity workspace

Status: `BLOCKED_BY_SPRINT_0`

Primary: `senior-fullstack-builder`

Specialists: `documentation-roadmap`, `security-privacy-auditor`, `frontend-ux-accessibility`

Objective:

Expose useful traceability for create, duplicate, edit, emit, PDF, send, payment, cancel and automation events without duplicating operational cards.

Acceptance:

- uses existing audit trail when sufficient;
- source and target relations are visible where relevant;
- event payloads minimize personal data;
- one compact timeline/activity section;
- no false event is recorded before the underlying action is confirmed.

### Sprint 9 — PDF immutability and communication handoff

Status: `BLOCKED_BY_SPRINT_0`

Primary: `senior-fullstack-builder`

Specialists: `security-privacy-auditor`, `supabase-guardian`, `qa-e2e-specialist`

Objective:

Preserve the exact document associated with an emitted invoice and design safe preview/download/email/WhatsApp handoff.

Acceptance:

- emitted document version cannot be silently changed by later edits;
- private storage and short-lived access rules are respected;
- preview and download use the correct version;
- send action occurs only after human review;
- send result and failure are auditable;
- `Precios sin IVA` or other fiscal text follows verified configuration, not hard-coded guesswork;
- no public permanent invoice URL.

### Sprint 10 — Automation worker/agent architecture

Status: `BLOCKED_BY_SPRINTS_7_AND_9`

Primary: `enterprise-agent-architect`

Specialists: `security-privacy-auditor`, `business-rules-test-engineer`, `supabase-guardian`

Objective:

Design the future backend worker or agent that can schedule draft generation, reminders and approved communications with minimum privilege.

Acceptance:

- runs outside browser code;
- tools and permissions are explicit;
- no `service_role` exposure to clients;
- deterministic code owns calculations and eligibility;
- human approval gates are defined;
- idempotency, retries, dead-letter handling and audit records are specified;
- secrets remain in trusted runtime only;
- production deployment is a separate roadmap/gate.

### Sprint 11 — Integrated QA, documentation and release readiness

Status: `BLOCKED_BY_IMPLEMENTATION_SPRINTS`

Primary: `qa-e2e-specialist`

Specialists: `documentation-roadmap`, `security-privacy-auditor`, `frontend-ux-accessibility`, `release-deployment-guardian`

Independent decision: `pr-quality-gate`

Objective:

Prove the complete billing workflow and reconcile documentation before any release decision.

Minimum matrix:

- normal invoice creation;
- create from previous invoice;
- source remains unchanged;
- draft numbering safety;
- fiscal snapshot and numbering-gap rejection;
- contextual concept search and create-new;
- keyboard/mobile/tablet behavior;
- service eligibility and duplicate prevention;
- client billing defaults and override;
- recurring generation idempotency;
- partial/full payment coherence;
- cancellation/archive/correction boundaries;
- audit provenance;
- PDF version selection;
- send approval and failure path;
- RLS/zero-row/missing-RPC/readback errors;
- lint, tests, build and any repository agent validation.

Release verdict must distinguish `PASS`, `FAIL`, `BLOCKED` and `NOT_EXECUTED`.

## DATA AND API IMPACT

Sprint 0 must inventory before any change:

- invoice and invoice-line contracts;
- job/service billing fields and line contracts;
- quote-to-job-to-invoice links;
- payment and income derivation;
- recurring-service structures;
- audit trail schema/API;
- fiscal snapshot metadata;
- document/PDF storage metadata;
- current RPC ownership and grants;
- RLS policies affecting browser-authenticated reads/writes.

Potential schema/RPC changes are not approved by this roadmap. They require:

1. source-level design;
2. `supabase-guardian` review;
3. disposable/local proof;
4. rollback/recovery design;
5. exact QA authorization;
6. explicit production authorization later.

## SECURITY AND PRIVACY

- authenticated identity must be verified at every write boundary;
- browser code uses only the publishable key and user session;
- no service role, SMTP secret or document signing secret in frontend code;
- private invoice documents only;
- audit events minimize PII;
- concept history must not leak data outside authorized internal scope;
- automation has minimum tools and cannot self-expand permissions;
- source invoice, payment and document relations are immutable unless an approved correction flow says otherwise.

## VALIDATION PLAN

Every implementation sprint must run the real repository commands discovered in Sprint 0. At minimum where applicable:

- focused unit tests;
- focused integration tests;
- E2E or visible local QA for critical flows;
- `npm run lint`;
- `npm run build`;
- repository agent validation when configured;
- git diff and status review;
- commit and push.

Tests not executed must remain `NOT_EXECUTED`.

## ROLLBACK PLAN

- documentation-only Sprint 0: revert its commit;
- frontend-only slices: revert isolated sprint commit;
- data-contract code: preserve backward compatibility or provide dual-read/rollback contract;
- prepared migrations/RPCs: include forward and recovery proof before any remote authorization;
- generated drafts: use explicit lifecycle/cancellation rules, never delete emitted fiscal history;
- release: use repository release/deployment procedures and exact previous known-good commit.

## KEY RISKS

- existing `Crear factura como esta` may copy more or less than the UI implies;
- provenance may be missing or hidden in ad hoc state;
- invoice and payment statuses may represent different dimensions;
- service-to-invoice relationships may not prevent concurrency duplicates;
- concept history may be distributed across quotes, invoices, jobs and recurring records;
- recurring draft generation may duplicate work without a stable idempotency key;
- PDF regeneration may overwrite the version associated with issuance;
- current client portal work touches invoice document security and must remain isolated;
- migration-history and DB push locks prohibit casual remote database changes.

## OPEN DECISIONS FOR SPRINT 0

- exact copy allowlist for existing invoice reuse;
- provenance storage location;
- source of due-date/payment-term rules;
- whether discounts exist in the current canonical line/invoice contract;
- canonical concept source and ranking weights;
- canonical definition of service eligibility and partial billing;
- where client billing preferences belong;
- current PDF immutability/version behavior;
- exact repository test commands and fixtures for finance flows.

## IMPLEMENTATION HANDOFF

The first work block is Sprint 0 only.

It is documentation and diagnosis. It must not implement product code, modify Supabase, create migrations, change RLS/RPCs, run remote writes or alter active client portal work.

After Sprint 0 is committed and pushed, use `pr-quality-gate` for independent review. Only then should Sprint 1, 2 or 3 be selected according to the evidence and dependency map.
