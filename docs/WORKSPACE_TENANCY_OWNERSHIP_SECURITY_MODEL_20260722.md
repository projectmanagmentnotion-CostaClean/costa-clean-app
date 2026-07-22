# Workspace / Tenancy / Ownership Security Model — 2026-07-22

## Gate 3 decision

**Decision: conditionally accepted for the current operating model.** The source-defined model is acceptable only while Costa Clean remains one mutually trusted workspace whose authenticated users are all authorized to see the shared operational dataset and to use the currently exposed authenticated actions. This is a bounded operating exception, not evidence of tenant isolation or role-based authorization.

Adding another company, workspace, franchise, contractor population, or differently trusted users requires a separately authorized ownership model before those users are onboarded. The future change must be designed and proven in QA first; this gate does not authorize schema, policy, grant, RPC, Auth, data, migration, frontend, or production changes.

Gate 3 is closed at the source/catalog-evidence and decision-documentation level. Gate 4 — Public Quiz RPC Abuse Protection — is the next gate. Gate 4 work is not started here.

## Evidence classification and limits

| Classification | What this report can establish | What it cannot establish |
| --- | --- | --- |
| Versioned source | Auth bootstrap, session-bearing REST helpers, table/relationship definitions, migration-defined policies, grants and RPC guards | Current unversioned dashboard settings, current Auth users, user metadata, or drift after the recorded gates |
| Recorded catalog/live evidence | The dated security reports record QA/production catalog checks, anonymous/authenticated probes, and the exact migrations applied at those gates | A fresh 2026-07-22 live re-check in this work block; no remote access was authorized or performed |
| Inference | Applying the four versioned migrations in documented order produces workspace-wide authenticated read predicates and authenticated RPC boundaries without tenant/owner predicates | A claim that every live environment still matches source today |
| Not applicable | Live visual QA for a documentation-only security-model decision | Simulated browser evidence or reuse of private auth/storage artifacts |

Primary source evidence:

- The shell obtains the Supabase session, subscribes to Auth changes, and renders `AuthPage` when no session exists (`src/App.tsx:91`, `src/App.tsx:113`, `src/App.tsx:221`). Password sign-in is the only application login UI (`src/features/auth/AuthPage.tsx:28`).
- Internal REST reads reject a missing token or a token equal to the anon key and send `session.access_token` as bearer (`src/lib/supabaseRest.ts:50-64`, `src/lib/supabaseRest.ts:67-84`, `src/lib/supabaseRest.ts:103`). The explicit REST write helper applies the same fail-closed rule (`src/lib/authenticatedSupabaseWrite.ts:38-46`, `src/lib/authenticatedSupabaseWrite.ts:66`).
- The schema baseline defines 17 public tables (`supabase/migrations/20260721_qa_baseline_schema.sql:1984-2527`) and their relationship paths (`supabase/migrations/20260721_qa_baseline_schema.sql:3133-3269`).
- The read-closure migration creates authenticated read policies using only `auth.uid() is not null`, revokes public/anon SELECT, and grants SELECT to `authenticated` (`supabase/migrations/20260722_close_anon_read_policies_qa_verified.sql:163-217`).
- Operational write RPCs are `SECURITY DEFINER`, use a fixed `search_path`, invoke an authentication guard, deny public/anon execution and grant the allowlisted entry points to `authenticated` (`supabase/migrations/20260721_rls_clients_properties_jobs_write_fix.sql:3-281`). Lead RPCs follow the same boundary; the quiz submission RPC is the intentional anonymous exception (`supabase/migrations/20260722_close_anon_read_policies_qa_verified.sql:3-156`).
- Recorded production catalog evidence confirms the operational RPC hardening and zero unsafe global authenticated write policies at that gate (`docs/PRODUCTION_RLS_RELEASE_GATE_20260722.md`, “Post-apply verification”). Recorded read-closure evidence confirms anonymous denial and authenticated reachability for the ten protected resources (`docs/PRODUCTION_ANON_READ_CLOSURE_GATE_20260722.md`, “Probes before/after”). These are historical gate records, not fresh live claims.

## Authenticated bootstrap and session enforcement

The application enforces authentication at three relevant layers:

1. Public standalone routes are selected before the authenticated shell. All other routes bootstrap `client.auth.getSession()`, track `onAuthStateChange`, and render the shell only with a non-null session (`src/App.tsx:68-123`, `src/App.tsx:221-229`).
2. Internal REST reads obtain the singleton Supabase session and reject absent/anon-equivalent bearer tokens before `fetch` (`src/lib/supabaseRest.ts:50-84`). Supabase-js readers use the same client session; representative direct readers include annual closings, expenses and quarterly closings (`src/features/annualClosing/annualClosingApi.ts`, `src/features/expenses/expenseApi.ts`, `src/features/quarterlyClosing/quarterlyClosingApi.ts`).
3. Authenticated REST/RPC write helpers require `session.access_token`; versioned RPC guards reject `auth.uid() is null` (`src/lib/authenticatedSupabaseWrite.ts:76-94`; `supabase/migrations/20260721_rls_clients_properties_jobs_write_fix.sql:3-16`; `supabase/migrations/20260721_qa_baseline_schema.sql:941-955`).

There is no application role selection, tenant selection, workspace switcher, membership lookup, or authorization decision based on Supabase `app_metadata`/`user_metadata`. The authenticated shell receives no user/role context beyond session existence (`src/App.tsx`). Repository searches across `src/`, `supabase/`, `sql/`, and `api/` found no `workspace_id`, `tenant_id`, `team_id`, `company_id`, `owner_id`, membership contract, or custom role-claim contract. This is a source-only absence claim.

## Protected-table and relationship evidence matrix

“Current source enforcement” below describes the effective shape produced by the versioned baseline plus the later RLS/RPC and anonymous-read closure migrations. It does not replace the dated live reports.

| Table / domain | Relationship and ownership-like evidence | Current source enforcement | Tenancy conclusion |
| --- | --- | --- | --- |
| `clients` | Root commercial record; `source_lead_id` is provenance, not owner. No user/workspace key (`baseline:2028-2043`) | Authenticated workspace-wide SELECT; create/update only through guarded allowlisted RPCs; no row-owner predicate | Every authenticated user can read every client and invoke the same client RPCs |
| `properties` | Belongs to `clients` through `client_id` (`baseline:2424-2440`, FK `3237`) | Authenticated workspace-wide SELECT; guarded create/update/reassign RPCs | Client relationship propagates business context, not workspace ownership |
| `leads` | May link to converted client and public intake; no actor/workspace key (`baseline:2348-2372`, FK `3221`) | Authenticated workspace-wide SELECT; guarded create/update RPCs | Public provenance and conversion links do not identify an authorized owner |
| `quotes` | Links to lead/client/property (`baseline:2527-2548`, FKs `3253-3269`) | Authenticated workspace-wide SELECT; financial/quote RPC allowlist for writes | No creator, assignee, team or workspace restriction |
| `quote_lines` | Child of quote with cascade (`baseline:2506-2521`, FK `3245`) | Authenticated workspace-wide SELECT; mutations occur through protected quote workflows after legacy public policies are removed | Isolation can only be inherited conceptually from quote; no enforceable tenant key exists |
| `jobs` | Links to client/property/quote (`baseline:2279-2302`, FKs `3189-3205`) | Authenticated workspace-wide SELECT; guarded status/save RPCs | Scheduling data is shared across the one workspace; no employee assignment authorization |
| `job_lines` | Child of job with cascade (`baseline:2258-2273`, FK `3181`) | Authenticated SELECT `USING (true)` from baseline; writes are inside guarded job save RPC | Child relation is not an RLS ownership boundary |
| `invoices` | Links to job/client/property/quote (`baseline:2205-2228`, FKs `3149-3173`) | Authenticated workspace-wide SELECT; writes through authenticated financial RPCs guarded by `require_authenticated_financial_write()` | Financial access is authenticated but not separated by role or ownership |
| `invoice_lines` | Child of invoice with cascade (`baseline:2184-2199`, FK `3141`) | Authenticated workspace-wide SELECT; line mutation contained in financial RPCs after legacy public policies are removed | No independent owner/workspace key; future policy should inherit invoice authorization |
| `payments` | Child of invoice (`baseline:2390-2406`, FK `3229`) | Authenticated workspace-wide SELECT; payment workflows are guarded authenticated RPCs | Any authenticated user is not source-prevented from seeing all payments or calling granted financial workflows |
| `expenses` | Standalone financial record; no client/user/workspace key (`baseline:2061-2131`) | Authenticated SELECT/INSERT/UPDATE policies use unconditional `true` (`baseline:3283`, `3304`, `3325`) | Direct broad authenticated financial access; primary role-model gap |
| `quarterly_closings` | Standalone fiscal snapshot; no actor/workspace key (`baseline:2480-2493`) | Authenticated SELECT/INSERT/UPDATE policies use unconditional `true` (`baseline:3290`, `3311`, `3332`) | Direct broad authenticated fiscal access; no accounting/admin boundary |
| `annual_closings` | Standalone fiscal snapshot; no actor/workspace key (`baseline:1984-1995`) | Authenticated SELECT/INSERT/UPDATE policies use unconditional `true` (`baseline:3276`, `3297`, `3318`) | Direct broad authenticated fiscal access; no accounting/admin boundary |
| `audit_events` | `changed_by uuid default auth.uid()` is the sole direct actor column found; entity references are polymorphic text, not FKs (`baseline:2008-2022`) | Authenticated read when `auth.uid()` is non-null (`baseline:3528`); `record_audit_event` is a guarded RPC | Actor attribution supports audit, but does not authorize the affected row or workspace |
| `intake_submissions` | Public intake root; circular deferred link with `lead_drafts` and optional lead/quote IDs (`baseline:2158-2178`, FKs `3133`, `3213`) | Authenticated manage policy checks only non-null `auth.uid()`; intentional anonymous intake INSERT remains (`baseline:3514`, `3577`) | Public submission is a narrow business exception; internal records are still workspace-wide |
| `lead_drafts` | Child of intake submission; may link to lead (`baseline:2320-2342`, FK `3213`) | Authenticated manage policy checks only non-null `auth.uid()` (`baseline:3521`) | All authenticated users can manage all drafts |
| `public_gym_manual_quiz_attempts` | Worker name and result; no Auth user/workspace relation (`baseline:2458-2474`) | Stored history is authenticated workspace-wide; anonymous submission only through validated `submit_public_gym_manual_quiz_attempt(jsonb)` RPC (`closure:95-156`, `163-217`) | Intentional public ingress has no tenant/employee identity binding; abuse protection is Gate 4 |

Evidence shorthand in this table uses `supabase/migrations/20260721_qa_baseline_schema.sql` for `baseline` and `supabase/migrations/20260722_close_anon_read_policies_qa_verified.sql` for `closure`.

## Effective policy, grant, and RPC shape

### RLS policies

- All 17 public tables are defined with RLS enabled in the baseline (`supabase/migrations/20260721_qa_baseline_schema.sql:3584-3687`).
- Ten operational/commercial/financial/history tables receive `TO authenticated FOR SELECT USING (auth.uid() is not null)` in the closure migration (`supabase/migrations/20260722_close_anon_read_policies_qa_verified.sql:163-203`).
- `job_lines`, annual/quarterly closings and expenses retain workspace-wide authenticated predicates using `true` (`supabase/migrations/20260721_qa_baseline_schema.sql:3276-3332`, `3596`).
- `audit_events`, `intake_submissions`, and `lead_drafts` check only that `auth.uid()` is non-null (`supabase/migrations/20260721_qa_baseline_schema.sql:3514-3528`).
- Legacy anonymous SELECT and targeted commercial/financial write policies are removed by catalog-driven loops (`supabase/migrations/20260722_close_anon_read_policies_qa_verified.sql:158-190`). Client/property/job anonymous write policies are removed by the prior migration (`supabase/migrations/20260721_rls_clients_properties_jobs_write_fix.sql:258-264`).
- No final source predicate compares `auth.uid()` to a row owner, membership, workspace, team, assignment, or role.

### Grants

- The closure migration explicitly revokes table SELECT from `PUBLIC`/`anon` and grants it to `authenticated` for all 17 tables (`supabase/migrations/20260722_close_anon_read_policies_qa_verified.sql:206-219`).
- Sensitive RPC execution is revoked from `PUBLIC`/`anon`; the allowlisted non-guard functions are granted to `authenticated`, while guard functions are non-callable directly (`supabase/migrations/20260722_close_anon_read_policies_qa_verified.sql:221-249`).
- Client/property/job RPC grants are separately restricted to authenticated (`supabase/migrations/20260721_rls_clients_properties_jobs_write_fix.sql:266-281`).
- The quiz submission RPC is intentionally executable by `anon` and `authenticated`; public history remains closed (`supabase/migrations/20260722_close_anon_read_policies_qa_verified.sql:151-156`).
- The baseline is a schema-only export created without ACLs, so it is not sufficient by itself to reconstruct every table DML grant. Dated catalog reports remain the authority for the live gate result: production had zero anonymous SELECT grants on the ten target tables, zero scoped legacy anonymous write policies, and zero sensitive anonymous RPC grants after closure (`docs/PRODUCTION_ANON_READ_CLOSURE_GATE_20260722.md`, “Probes before/after”).

### Security-definer boundaries

The source uses guarded `SECURITY DEFINER` RPCs to narrow complex writes without adding global authenticated write policies:

- Operational: client create/update, property create/update/reassign, job status and job-with-lines (`supabase/migrations/20260721_rls_clients_properties_jobs_write_fix.sql`; `src/lib/operationalWriteRpc.ts`).
- Lead/intake: lead create/update and conversion/lead-quote workflows (`supabase/migrations/20260722_close_anon_read_policies_qa_verified.sql:3-91`; baseline function definitions).
- Financial/commercial: quote, invoice, payment, acceptance, status, snapshot and audit workflows call `require_authenticated_financial_write()` or an authenticated guard and use fixed search paths (`supabase/migrations/20260721_qa_baseline_schema.sql:40-1977`; `supabase/migrations/20260707_fix_same_number_invoice_update_gap.sql:1-178`).
- Public exception: the quiz submit RPC has payload/result consistency validation but deliberately no Auth guard (`supabase/migrations/20260722_close_anon_read_policies_qa_verified.sql:95-149`).

These boundaries establish authenticated entry and payload constraints. They do not establish which authenticated user may act on which row, and `SECURITY DEFINER` makes that missing authorization check especially important before trust boundaries expand.

## Current guarantees

Subject to source matching the deployed catalog, the current model guarantees:

- Internal UI and REST data loading require a valid Supabase session bearer; the anon key is not accepted as the internal bearer.
- Anonymous table history/read access covered by the 2026-07-22 closure is denied in the recorded QA and production gate evidence.
- Allowlisted operational and sensitive RPCs require authenticated execution, use fixed `search_path` where defined as `SECURITY DEFINER`, and hide internal guard functions from direct callers.
- Business relationships and foreign keys preserve client/property/quote/job/invoice child integrity.
- Selected lead/quote/invoice/payment/expense changes can record the acting `auth.uid()` in `audit_events.changed_by` through `record_audit_event` (`src/features/auditTrail/auditTrailApi.ts`; baseline `862-895`, `2008-2022`).

## Explicit non-guarantees

The current model does **not** guarantee:

- isolation between companies, workspaces, franchises, departments, teams, or users;
- owner/admin, supervisor, employee, accounting, or read-only authorization;
- least-privilege separation between operational and financial/fiscal domains;
- creator/assignee-only access to leads, clients, properties, quotes, jobs, invoices, payments, expenses, or closings;
- workspace-scoped uniqueness, sequences, document numbering, reports, audit queries, or RPC effects;
- membership lifecycle controls such as invite, suspend, remove, transfer ownership, or last-owner protection;
- immutable or complete audit coverage for every table mutation;
- linkage between public quiz worker names and authenticated employee identities;
- protection of the public quiz RPC from automated abuse, rate bursts, replay, or platform-level denial of service; that is Gate 4;
- live QA/production equivalence beyond the dated reports cited above.

## Role matrix: current enforceability versus proposed behavior

The named roles are **not currently represented or enforceable**. Today they all collapse to the Supabase `authenticated` role.

| Intended role | Current enforceability | Proposed future read scope | Proposed future write/approval scope |
| --- | --- | --- | --- |
| Owner/admin | Not distinguishable from any authenticated user | Entire own workspace, membership and audit administration | Workspace settings/membership; all operational actions; protected financial actions subject to explicit confirmation and audit |
| Supervisor | Not distinguishable | Entire own workspace operational domains; financial summaries only if explicitly granted | Assign/manage leads, clients, properties, quotes and jobs; no membership ownership or unrestricted fiscal administration |
| Employee | Not distinguishable; no assignment column | Assigned jobs/properties plus minimum client contact/context required to perform work | Update assigned job operational state/notes; no invoice, payment, expense or closing mutation by default |
| Accounting | Not distinguishable | Own-workspace clients plus quotes, invoices, payments, expenses, closings and audit context | Financial/fiscal workflows; no membership ownership or unrelated operational administration by default |
| Read-only | Not distinguishable | Explicit own-workspace modules only | No business-table mutation and no state-changing RPC execution |

Future implementation should use a small stable role enum plus explicit capability checks for exceptional actions. UI hiding is not enforcement; RLS/RPC authorization must remain authoritative.

## Temporary-acceptance operating constraints

Temporary acceptance remains valid only while **all** of these conditions hold:

1. Costa Clean operates as exactly one logical workspace/company in this deployment.
2. Every authenticated account is mutually trusted to read the entire shared operational, personal, commercial, financial and fiscal dataset exposed to `authenticated`.
3. Every authenticated account is intentionally trusted with the currently granted RPC/direct-policy actions; job assignment or job title is not treated as a security boundary.
4. Account provisioning/removal is controlled operationally outside this app, because no membership lifecycle exists in source.
5. Public access remains limited to the explicitly reviewed intake/quiz submission contracts; internal table reads stay authenticated.
6. The database-push lock remains active, and no future migration or dashboard policy change broadens grants/policies without a separate reviewed gate.
7. The dated production catalog evidence is treated as historical evidence and is revalidated before any future security release.

## Conditions that immediately invalidate temporary acceptance

Any one of the following ends the exception and blocks onboarding or trust expansion until the ownership model is authorized and deployed:

- adding a second company, workspace, franchise, brand, independent contractor organization, or customer dataset;
- adding users who are not mutually trusted to view all personal, commercial, invoice, payment, expense and closing data;
- requiring employee-assigned-only records, accounting-only financial access, supervisor-only approvals, or read-only accounts;
- exposing partner/customer portals, external accountants, temporary staff, vendors, or API integrations under normal authenticated accounts;
- storing data subject to a contractual/regulatory separation requirement not met by workspace-wide reads;
- relying on UI navigation, hidden buttons, job titles, email domains, or informal process as an authorization boundary;
- finding source or live policy/grant drift that permits anon internal reads, broadens RPC execution, or bypasses Auth guards;
- creating ownership-like columns without complete propagation/backfill/RLS coverage, producing a mixed scoped/unscoped state.

## Separately authorized future isolation plan

This plan is technical design only. Every schema/Auth/policy/RPC/data/production phase requires its own explicit authorization. Routes, existing frontend Supabase contracts, current business logic, and protected invoice/payment/fiscal behavior must remain compatible throughout.

### Phase 0 — contract and authorization design

- Confirm whether the target is one workspace with internal roles, multiple companies, or both.
- Define `workspaces`, `workspace_memberships(user_id, workspace_id, role, status, ...)`, stable role values, invite/removal/last-owner rules, and capability exceptions.
- Define which entities are workspace roots and which inherit scope through parents. Decide whether employee assignment is a separate `job_assignments` relation instead of overloading ownership.
- Produce an RPC/capability inventory, protected financial-domain rules, public-ingress allowlist, threat model, and exact authorization boundaries.
- Preserve existing routes and request/response shapes; tenant selection should be additive and session-derived, not a rewrite of module contracts.

### Phase 1 — additive schema in isolated QA

- Add workspace and membership tables plus nullable `workspace_id` on root business tables. Candidate roots: clients, leads, expenses, annual/quarterly closings, intake submissions and quiz attempts; quote/job/invoice/payment children may carry an explicit key for robust policy/indexing while being consistency-checked against parents.
- Add actor/assignment columns only where the product contract requires them (`created_by`, `updated_by`, job assignments); do not confuse them with workspace ownership.
- Add indexes, composite uniqueness and consistency constraints. Financial document identifiers and fiscal sequences require a separately reviewed choice between global and workspace-scoped semantics; do not change them as an incidental tenancy migration.
- Keep columns nullable and policies behaviorally compatible during this phase; no production apply.

### Phase 2 — deterministic ownership propagation and backfill proof

- Create exactly one canonical Costa Clean workspace and membership fixtures in disposable/isolated QA.
- Backfill root rows to that workspace, propagate through client → property/quote/job/invoice/payment and quote/job/invoice → line relationships, and reconcile intake → draft → lead → client paths.
- Fail on orphan, cross-workspace relation, unknown Auth user, or ambiguous ownership. Produce counts/hashes only; no real row bodies in versioned reports.
- Add `NOT NULL`/consistency constraints only after zero-null and zero-mismatch proof. Backfill production requires a later independent authorization, backup, rollback artifact and exact target verification.

### Phase 3 — RLS and RPC authorization strategy

- Centralize membership/capability checks in reviewed SQL helpers with fixed search paths; do not expose helpers directly.
- RLS SELECT predicates must require active membership in the row workspace. INSERT/UPDATE/DELETE predicates must additionally enforce role/capability and workspace immutability.
- Child-table policies should use indexed explicit `workspace_id` or verified parent joins consistently; public ingress receives only narrow validated RPCs and never public history.
- Every `SECURITY DEFINER` RPC must resolve the caller through `auth.uid()`, validate active membership and required capability, lock/validate target workspace, reject cross-workspace IDs, and retain payload allowlists.
- Accounting and owner/admin capabilities must be explicit around invoices, payments, expenses and closings. Existing numbering, emission, payment and fiscal logic remains unchanged unless separately authorized.

### Phase 4 — frontend compatibility and staged activation

- Preserve current routes and existing Supabase table/RPC payloads where possible. Resolve the active workspace after session bootstrap; with one membership, auto-select without adding friction.
- Add a workspace switcher only when multiple memberships are an approved product requirement.
- Add role-aware affordances for usability, while treating database authorization as authoritative and surfacing 401/403 without fallback.
- Use compatibility views/defaulted RPC parameters only if they do not permit caller-selected workspace escalation. Never trust an arbitrary frontend `workspace_id` without membership verification.

### Phase 5 — QA-first validation

- Build a synthetic matrix with at least two workspaces and all five roles. Prove allow and deny cases for every table and RPC, including guessed IDs, cross-workspace foreign keys, suspended membership, role downgrade, user removal and last-owner rules.
- Verify anon denial, public intake/quiz submission, authenticated app reads, operational flows, and protected financial read/write boundaries.
- Run lint, build, tests, source/catalog inspection, live REST/RPC probes, multi-viewport authenticated visual QA, and dry-run flow QA against the exact QA build. Any real write test requires existing sandbox write-and-clean/reset protections and separate authorization.
- Require zero cross-workspace rows returned/affected and exact audit attribution. An HTTP 2xx with zero affected rows is not sufficient write evidence.

### Phase 6 — rollout, rollback, and authorization boundaries

- Separate additive schema, backfill, policy activation, frontend activation and production release into reviewable gates. No gate authorizes the next automatically.
- Before production mutation: exact migration/hash allowlist, public/private target identity, schema-only backup, row-count/null/mismatch fingerprints, tested rollback, maintenance/compatibility decision and monitoring plan.
- Prefer rollback by disabling new frontend activation while retaining additive columns. Policy rollback must restore the exact prior catalog from private evidence and is security-regressive; data backfill reversal must never delete business rows.
- Never use `db push` while `docs/DB_PUSH_LOCK.md` remains active. Migration-history and CLI safety are independent gates.
- Commit, push, deploy, Auth-user changes, membership invitations, schema/data writes and production actions each require the authorization applicable at that time. This document grants none of them.

## Residual risks carried forward

- The accepted model remains broad authenticated access with no internal least privilege.
- `audit_events.changed_by` is useful but incomplete as an authorization/audit model; not every table mutation is proven to emit an event.
- The public quiz RPC remains an intentional anonymous surface without rate limiting/abuse controls; Gate 4 owns that risk.
- The database-push lock remains explicit and unchanged (`docs/DB_PUSH_LOCK.md`). Metadata repair did not prove a safe CLI zero-SQL transition.
- The recorded `358/360` visual result remains separate unresolved UI/harness debt from the production metadata gate (`docs/PRODUCTION_MIGRATION_METADATA_REPAIR_GATE_20260722.md`; `docs/RISK_MAP.md`). It does not affect this source-only security decision and is not resolved here.
- Live visual QA is not applicable to this documentation-only gate. No browser, QA, production, Auth profile, storage state, or private report was accessed.

## Work-block validation

- Initial HEAD: `c570d1eea479ba4da6e2229615876f413530c5e4` on `main`, matching `origin/main` at inspection time.
- Continuation output HEAD: unchanged at `c570d1eea479ba4da6e2229615876f413530c5e4`; that automatic iteration correctly did not commit or push. Publication belongs to the later, separately authorized closeout sprint.
- `git diff --check`: exit `0`.
- `npm.cmd run lint`: exit `0`; ESLint completed with no reported findings.
- `npm.cmd run build`: exit `0`; `tsc -b && vite build` completed, Vite `v8.0.0` transformed `375` modules.
- `npm.cmd run db:push`: intentional exit `1`; printed `BLOCKED: Supabase db push is disabled for this repository.`
- `npm.cmd run supabase:db:push`: intentional exit `1`; printed the same fail-closed lock message.
- Supabase CLI push/repair/history command: not invoked.
- Tracked-path private-artifact/non-example-env scan: `0` matches.
- Live visual QA: not applicable; documentation-only gate.
- Production affected: `NO`. QA affected: `NO`. Schema affected: `NO`. Data affected: `NO`. Application code affected: `NO`. Auth affected: `NO`. Financial/fiscal behavior affected: `NO`. Secrets accessed/versioned: `NO` / `0`. The automatic continuation itself did not commit or push; publication is recorded by the separately authorized closeout sprint.

## Gate 3 closure statement

Gate 3 is **complete** with a conditional temporary acceptance, quality verdict `complete`, and no implementation authorization. The current source model is suitable only for one mutually trusted Costa Clean workspace. It must not be described as multi-tenant, owner-scoped, role-enforced, or least-privilege. Gate 4 is next; Gate 5 remains later. Production, QA, schema, data, application code, Auth, financial behavior, secrets, commit and push are unaffected by this decision document.
