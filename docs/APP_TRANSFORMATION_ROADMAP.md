# App Transformation Roadmap

## Purpose

This roadmap defines the phased transformation path for the app, from governance through final hardening, while preserving operational safety.

## Operating Rules

- Diagnose first.
- Preserve current production logic unless the active sprint explicitly targets it.
- Use the UX manual and quality gates as the control layer for every phase.
- Favor small, validated increments over broad redesign attempts.

## Cross-Cutting UI Scaling Rule

- Reduce encapsulation before adding new cards.
- Keep filters compact and secondary to content.
- Hide debug panels from normal operational flow.
- In visual sprints, validate mobile/iPad against the running app with real captures.

## Sprint 0: Documentation And Governance

Objective:

Create the control layer that governs all future work.

Deliverables:

- `AGENTS.md`
- `docs/UX_APP_MANUAL.md`
- `docs/CODEX_WORKFLOW.md`
- `docs/APP_QUALITY_GATES.md`
- `docs/APP_TRANSFORMATION_ROADMAP.md`
- `.github/pull_request_template.md`

Outcome:

Every future agent or contributor works under the same UX, StepFlow, engineering, and verification rules.

## Sprint 1: Real Audit Of The Current App

Objective:

Audit the live implementation, screen by screen and flow by flow, without assuming the architecture from theory.

Focus:

- route and shell map
- current UX patterns
- mobile constraints
- real state handling
- friction and duplication
- risk register for critical logic

## Sprint 2: Base Design System

Objective:

Define the minimal reusable design system that aligns the app without rewriting business logic.

Focus:

- spacing and typography tokens
- color semantics
- button hierarchy
- base cards
- badges
- form primitives
- state primitives

## Sprint 3: Reusable StepFlow Engine

Objective:

Create a reusable StepFlow foundation for important flows.

Focus:

- step container
- progress model
- validation slots
- review step pattern
- success state pattern
- mobile-first flow ergonomics

## Sprint 4: AppShell And Navigation

Objective:

Modernize the shell and navigation hierarchy while preserving route contracts unless a dedicated migration is approved.

Focus:

- calmer navigation
- clearer active context
- reduced branching
- consistent entry and return patterns

## Sprint 5: Dashboard

Objective:

Turn the dashboard into a decision-first operational console.

Focus:

- one dominant daily priority
- reduced decorative metrics
- clearer action queue
- stronger operational status language

## Sprint 6: Public Intake / Form

Objective:

Transform the public intake experience into a focused, isolated, modern flow.

Focus:

- shell-free public route pattern
- mobile-first completion
- calm step progression
- safe submission states

## Sprint 7: Quotes StepFlow

Objective:

Move quote creation and progression into a safer StepFlow model.

Focus:

- quote drafting
- client/service context
- review and send states
- conversion readiness

## Sprint 8: Safe Invoice StepFlow

Objective:

Introduce StepFlow for invoice emission without compromising fiscal or business safety.

Focus:

- staged validation
- review before irreversible actions
- explicit totals and consequences
- safe success and recovery states

## Sprint 9: Clients

Objective:

Make clients a clearer operational workspace instead of a flat directory-first experience.

Focus:

- action-first entry
- cleaner profile/workspace structure
- relationship visibility
- safe editing boundaries

## Sprint 9A: Global Filters, Sorting, And List Organization

Objective:

Standardize the search, filter, sort, and result-reading pattern across operational lists without touching persistence, routes, or business rules.

Focus:

- one control surface per list
- recent-first defaults when the module contract supports it
- visible active filters and quick reset
- mobile-first compact controls
- reuse over duplicate toolbars
- zero backend coupling for list state

## Sprint 10: Services / Quick Logging

Objective:

Improve service creation, service progress, and rapid operational logging.

Focus:

- faster entry
- better current-status visibility
- mobile-first service actions
- reduced friction in repetitive work

## Sprint 11: Finance

Objective:

Unify finance-facing surfaces into clearer operational and review patterns.

Focus:

- invoices
- payments
- expenses
- fiscal preparation surfaces
- trust and caution language

## Sprint 12: Global States

Objective:

Standardize global state behavior across the app.

Focus:

- loading
- empty
- error
- saving
- saved
- success
- toast and inline confirmation discipline

## Sprint 13: Accessibility And Mobile QA

Objective:

Verify that the transformed app works credibly on mobile and meets accessibility expectations.

## Motion Phase 3: StepFlow, Overlays, And Density Polish

Objective:

Compact the shared full-screen flows and overlay surfaces, adding only functional GSAP transitions with reduced-motion safety.

Focus:

- shared StepFlow density
- overlay and dialog entrance motion
- compact sticky action bars
- copy reduction in long multi-step flows
- preservation of critical invoice and fiscal signals

Focus:

- keyboard and focus behavior
- touch target quality
- contrast
- reduced motion considerations
- narrow-screen completion of key flows

## Sprint 14: Final QA And Hardening

Objective:

Perform end-to-end hardening before declaring the transformation complete.

Focus:

- visual QA
- functional QA
- regression review
- StepFlow consistency
- documentation alignment
- release readiness evidence

Outcome:

- final QA documented
- residual debt prioritized
- final risks documented
- next phase re-scoped from broad UX transformation to targeted technical hardening and authenticated QA

## Success Criteria Across All Phases

- no blind redesigns
- no hidden business-logic changes
- no dependency drift without explicit need
- every phase validated with repo quality gates
- every phase documented honestly

## Status Snapshot

As of Sprint 14 closure:

- Sprint 0 through Sprint 14 are completed at governance / UX-foundation level.
- The app now has a controlled UX baseline: repo governance, design system foundation, official StepFlow, unified list controls, global state primitives, and base mobile/accessibility hardening.
- The remaining work is not "finish modernizing the UI". The remaining work is targeted hardening of sensitive domains and authenticated end-to-end QA.

## Post-Roadmap Motion Phases

### Motion Phase 1: GSAP Foundation And Manual

Objective:

Add a controlled GSAP foundation, reduced-motion support, shared presets, and a global motion manual without animating productive surfaces yet.

### Motion Phase 1B: GSAP Plugins Foundation Audit

Objective:

Audit plugin availability in the real package, add safe registration helpers, define approved usage, and document policy before productive adoption.

### Motion Phase 2: Home GSAP Dashboard

Objective:

Apply controlled GSAP motion to Home/Inicio using quick actions, KPI surfaces, lightweight SVG charts, and subtle section reveals without touching business logic.

### Motion Phase 3: Animate StepFlow And Overlays

Objective:

Apply motion to StepFlow, sheets, dialogs, and overlays where the transition clarifies focus and progression.

### Motion Phase 4: Visual Home, Pro Forms, And Smart Minimal Suggestions

Objective:

Make Home more visual and compact while introducing smarter local-first form helpers without touching write paths or critical business rules.

Focus:

- compact visual Home hierarchy
- pro form field wrappers
- local postal code and city suggestions
- inline concept autocomplete
- subtle motion only where already approved

### Motion Phase 5: Home Visual Reset And Smart Forms Hardening

Objective:

Reset Home into a real visual cockpit and harden smart forms without touching critical write paths or domain logic.

Focus:

- remove long report-like blocks from Home
- compact visual KPIs and charts
- local alert acknowledgements for Home noise control
- smart location fields
- minimal concept autocomplete

## Motion Status Snapshot

As of Motion Phase 5:

- Motion Phase 1 is completed.
- Motion Phase 1B is completed.
- Motion Phase 2 is completed on `Home` as the first productive surface.
- Motion Phase 3 is completed on StepFlow and overlays.
- Motion Phase 4 is completed on visual Home and smart minimal form helpers.
- Motion Phase 5 is completed on Home visual reset and smart forms hardening.

## Post-Roadmap Sprint: Mobile First Reset

Objective:

Reset the live authenticated mobile reading layer for real iPhone density without reopening business logic or data contracts.

Focus:

- iPhone density tokens
- compact list controls
- compact operational cards
- collapsed invoice detail
- collapsed fiscal closing detail
- tighter StepFlow shell

## Post-Roadmap Sprint: Cross-module UI De-nesting QA

Objective:

Apply the same one-surface, compact-action, immediate-form rules across authenticated modules with live mobile/iPad validation.

Focus:

- cross-module de-nesting
- immediate action-to-form visibility
- compact filter bars
- shell/header overflow control on iPhone and iPad
- flattening of shared detail surfaces before any future scaling

## Post-Roadmap Sprint: Mobile Loading Polish

Objective:

Reduce skeleton noise, premature empty states, and `0` placeholders during mobile/iPad loading without touching protected business logic.

Focus:

- compact shared loading primitives
- delayed expanded loading for short transitions
- empty-state density reduction
- authenticated live QA on `390x844` and `768x1024`

## Post-Roadmap Sprint: Authenticated Visual QA Harness

Objective:

Create a reusable authenticated QA path independent from the embedded browser so future mobile/iPad hardening can be validated with repeatable local evidence.

Focus:

- isolated local QA profile
- reusable authenticated session metadata
- screenshots and reports in ignored local paths
- real view audit across `?view=` surfaces and core viewports

Status note:

- the first follow-up fix after the harness was a selector-hardening pass for `fiscal_closing` tablet, closing the last residual check and leaving the run at `240/240`
- the next follow-up hardening pass extends authenticated QA to `quotes`, `jobs`, and real create-flow openings, raising the run to `360/360`
- the `2026-07-16` recovery sprint restores the same `360/360` baseline after a later drop to `338/360`, confirming the remaining work is harness hardening plus small visual corrections, not a rollback of the embedded property fix
- closure evidence: [QA_BASELINE_RECOVERY_20260716.md](C:/Users/USUARIO/costa-clean-app/docs/QA_BASELINE_RECOVERY_20260716.md)

## Post-Roadmap Sprint: Embedded Property Create Hardening

Objective:

Close the sync and duplicate gaps when a property is created from another focused flow such as invoices.

Focus:

- immediate option injection in the parent selector
- explicit duplicate review scoped by client
- visible inline feedback for refresh failures
- no schema or route changes

## Post-Roadmap Sprint: End-User Flow Agent

Objective:

Create a reusable authenticated dry-run runner that behaves like an end user across the main creation flows without creating real business data.

Focus:

- dry-run guardrails by default
- safe opening and cancellation of main flows
- multi-viewport coverage on `390x844`, `768x1024`, and `1366x900`
- private local reports and screenshots only
- explicit skipped-dangerous-action reporting

Status note:

- current-build validation on `2026-07-19` passed lint, build, and `146/146` tests
- authenticated production reproduction still shows the old manual-invoice step-1 blocker
- local validation is blocked before auth because the required Supabase public environment variables are absent
- `QA_APP_URL` precedence and startup-error shell detection were hardened
- the sprint remains open until visual QA and flow dry-run are green against a URL serving the current build

## Post-Roadmap Sprint: Real Submit QA Failure Hardening

Objective:

Make safe submits observable, traceable, and cleanable without expanding access to fiscal or financial writes.

Status note:

- quote mobile/tablet footer geometry and stable QA selectors are corrected in source
- expense creation now preserves and displays the created id before returning to the list
- cleanup rejects zero affected rows and restricted writes are centrally intercepted
- client/property live submit remains green with six of six rows cleaned in `QA-AUTO-20260719-003838-THOX5J`
- closure was blocked on a deployed/current authenticated build for quote, expense, and invoice dry-run validation
- production `a1188ca` now contains the current source; authenticated visual QA is `360/360` and the full dry-run is `435/435`, including quote, expense, and invoice-create across mobile, tablet, and desktop
- the remaining real-submit gate is limited to non-financial write-and-clean evidence; the current environment skipped those submits because the public Supabase cleanup configuration was unavailable locally
- local configuration guidance now fixes the required contract to an ignored `.env.local` containing only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; the real submit-and-clean run remains blocked until those existing public values are provided locally
- the `2026-07-20` authorized-source audit found no local env, process env, ignored private config, linked Vercel CLI session, or Supabase CLI source; no `.env.local` was synthesized and no local QA/write was attempted
- local authenticated validation now passes visual QA and `435/435` dry-run checks; tablet shell actions were redistributed for `768x1024`, while full-submit and numbering restoration remain gated on a disposable Supabase QA environment rather than production sequence rewrites
- the QA sandbox blueprint defines environment fingerprinting, private env wrappers, demo seed, snapshot/reset, and phased full-flow gates; the isolated target and fingerprint now pass, while implementation is blocked on reviewed QA schema delivery
- service scheduling now opens with a compact upcoming agenda and explicit review states; client/property contextual dry-runs are covered, while service recurrence remains honestly blocked on a real domain contract

## Work PC Status - 2026-07-21

- `main` was synchronized by fast-forward to `a42bad7`, matching `origin/main`, with no local changes overwritten.
- The Recurring Operations and Service Scheduling sprint is complete at the current UX and dry-run scope: upcoming agenda, operational states, contextual client/property flows, and the explicit recurrence-contract skip are in place.
- The isolated Supabase QA target, ignored configuration, fingerprint guard, auth profile, and `snapshot-restore` strategy are validated. The reviewed baseline is applied and verified; full-flow submit remains blocked because synthetic seed, provider snapshot, and executed restore proof are absent.
- The deterministic synthetic seed and dry-run rerun now pass. The next recommended sprint is provider snapshot capture and restore proof. Real service recurrence remains a separate future domain-contract sprint and must not be simulated with recurring invoice plans.

## Full-Flow Sandbox Attempt - 2026-07-21

- Sandbox access and project separation pass for QA ref `kpvvydthlxupjjqqdpxy`; isolated auth also reaches the application shell.
- The original visual runner passed 42 structural checks but captured REST 404 errors; the applied schema and seed later closed that blocker.
- Current evidence is visual `360/360` and dry-run `588/588`, with 15 deterministic seed rows and zero flow-created entities. Invoice, payment, cancellation, numbering, and fiscal writes stay unavailable until restore execution and post-reset proof exist.
- Evidence: `docs/FULL_FLOW_SANDBOX_QA_20260721.md`.

## QA Schema Delivery Audit - 2026-07-21

- The initial audit classified reproducibility as `C`; the applied and verified baseline now changes core-schema readiness to `A-`, with the authoritative `recurring_invoice_plans` gap still open.
- The historical read-only probe reported every audited table missing; the later baseline apply and REST verification closed that gap for 17 tables.
- Schema and seed were applied only to QA. Full-submit and reset were not executed.
- The deterministic seed now passes dry-run, apply, idempotence, visual QA, and full dry-run. The next bounded gate is provider snapshot/restore proof; future Supabase CLI migration operations remain blocked until direct-`psql` history is reconciled.
- Evidence: `docs/QA_SANDBOX_SCHEMA_GAP_20260721.md`.

## Production Schema-Only Export Preflight - 2026-07-21

- The authorized schema-only export was obtained with `pg_dump 17.10`; no rows were exported and production received no writes.
- The private safety review passed and `supabase/migrations/20260721_qa_baseline_schema.sql` was created without secrets, owners, ACLs, managed schemas, or production sequence state.
- The authoritative schema lacks `recurring_invoice_plans`; the baseline records rather than invents that gap.
- The baseline was applied only to QA with PostgreSQL 17 `psql` in one atomic transaction. Verification found 17/17 tables, 41 functions, 15 triggers, 45 policies, RLS on 17 tables, and zero rows.
- Authenticated visual QA passed `360/360`; sandbox dry-run passed `588/588`. The deterministic seed now supplies 15 marked rows across eight non-fiscal tables, with zero runner-created entities. The next gate is restore proof, not full-submit or financial writes.
- Evidence: `docs/QA_SCHEMA_BASELINE_REVIEW_20260721.md`.

## Deterministic QA Seed - 2026-07-21

- `scripts/qa/seed-sandbox-demo.mjs` requires the sandbox wrapper, exact QA ref/fingerprint, private pooler validation, and no privileged frontend credentials.
- Marker `QA_DEMO_20260721` owns 15 rows across leads, clients, properties, quotes/lines, jobs/lines, and expenses.
- Apply is atomic and idempotent; unmarked ID collisions fail closed.
- Invoices, payments, closings, recurrence, full-submit, and reset remain untouched.
- Private post-seed counts are captured. The next gate is provider snapshot/restore proof before write-and-clean.

## QA Snapshot And Restore Proof - 2026-07-21

- Supabase Dashboard inspection confirmed that the QA Free plan has neither scheduled backups nor PITR, and no preview branch currently exists.
- PostgreSQL 17 captured an ignored private dump of QA `public` after verifying that all 15 rows belong to the deterministic synthetic baseline.
- `scripts/qa/prove-sandbox-restore.mjs` then inserted and removed one `QA_RESTORE_PROOF_20260721` lead with exact target, count, and cleanup guards.
- Leads returned `2 -> 3 -> 2`, total public rows `15 -> 16 -> 15`, and invoices/payments/closings stayed `0/0/0`.
- Post-cleanup authenticated visual QA passed `360/360`; sandbox dry-run passed `588/588` with zero created entities.
- Classification C logical cleanup is proven. Full provider/dump restore remains unproven, so the next separately authorized gate is bounded non-financial write-and-clean; destructive reset, full-submit, financial writes, migration-history repair, and `db push` remain blocked.

## Universal Product Correction And Release System - 2026-07-21

Objective:

Connect Costa Clean's existing governance to a reusable correction and release methodology without changing application code or relaxing protected-domain controls.

Deliverables:

- [UNIVERSAL_CORRECTION_SYSTEM.md](UNIVERSAL_CORRECTION_SYSTEM.md)
- [UX_UI_CORRECTION_SYSTEM.md](UX_UI_CORRECTION_SYSTEM.md)
- [UNIVERSAL_RELEASE_SYSTEM.md](UNIVERSAL_RELEASE_SYSTEM.md)
- [CODEX_UNIVERSAL_CORRECTOR_PROTOCOL.md](CODEX_UNIVERSAL_CORRECTOR_PROTOCOL.md)
- [UNIVERSAL_RISK_ZONES.md](UNIVERSAL_RISK_ZONES.md)
- [UNIVERSAL_RELEASE_LOG.md](UNIVERSAL_RELEASE_LOG.md)
- reusable templates under `docs/templates/`

This governance sprint is documentation-only. It does not authorize or modify production, Supabase, auth, routes, business logic, financial writes, fiscal operations or deployment behavior. Future Costa Clean corrections use the universal intake and release structure while continuing to pass every repository-specific quality gate.

## Full App Production Audit And Correction Pass - 2026-07-21

Objective:

Audit the complete application with source evidence and authenticated multi-viewport QA, then correct only verified production issues inside the safe local scope.

Outcome:

- repository, modules, routes, clients, UX/UI, responsive, accessibility signals, performance and protected domains inventoried
- wrong-product local QA target reproduced and closed with a fail-fast Costa Clean identity guard
- property-context service flow now starts at Agenda when client and property are already fixed
- authenticated sandbox visual QA passes `360/360`
- sandbox end-user dry-run passes `588/588` with zero created entities
- production, Supabase, auth, schema, migrations, invoices, payments, numbering, full-submit and financial writes remain untouched
- direct authenticated write-path risk for property/job, asset optimization and structural CSS debt remain separately scoped

Evidence:

- [FULL_APP_AUDIT_20260721.md](FULL_APP_AUDIT_20260721.md)
- [FULL_APP_AUDIT_FIXES_20260721.md](FULL_APP_AUDIT_FIXES_20260721.md)

## Post-Roadmap Sprint: RLS and RPC Write Path Fix — 2026-07-21

- QA selected authenticated, allowlisted RPCs instead of global authenticated policies because clients/properties/jobs have no tenant ownership columns.
- Client/property writes and quick job status persist in real QA with `session.access_token`; property reassignment and full job save remain RPC-based with hardened grants.
- Obsolete anon INSERT/UPDATE policies were removed only from the three target tables in QA.
- Cleanup closed `QA_RLS_FIX_20260721` and the prior marker to 0; the 15-row demo seed and financial `0/0/0` baseline remain intact.
- Production remains unchanged. The next gate is production readiness and coordinated rollout, not automatic migration apply or `db push`.
- Evidence: [RLS_WRITE_PATH_FIX_20260721.md](RLS_WRITE_PATH_FIX_20260721.md).

## Post-Roadmap Sprint: P0 Authenticated Read Closure in QA — 2026-07-22

- Internal REST reads now require the authenticated Supabase session and cannot fall back to the anon key as bearer.
- QA denies anonymous reads on the ten P0/P1 resources and anonymous execution on the audited sensitive RPC set.
- Public quiz submission remains through a narrowly validated RPC; public result history is removed.
- Authenticated QA remains functional (`360/360` visual); no business entity or financial operation was created by validation.
- Production remains unchanged. The next milestone is a separately authorized production release gate with exact migration/hash review and rollback evidence.
- Evidence: [P0_AUTHENTICATED_READ_PATH_CLOSURE_20260722.md](P0_AUTHENTICATED_READ_PATH_CLOSURE_20260722.md).

## Post-Roadmap Sprint: Production P0 Anonymous Read Closure — 2026-07-22

- The QA-verified migration was applied to the exact production ref after a private schema-only backup and dual public/private target validation.
- Anonymous REST access moved from HTTP 200 to HTTP 401 on all ten protected resources; authenticated access remains HTTP 200.
- Sensitive anonymous RPC grants and scoped legacy anonymous write policies are zero; public quiz submission remains narrowly available.
- Read-only authenticated app smoke passes `360/360` with no load errors, entities or submits.
- Remaining work is migration-history reconciliation and public endpoint abuse controls, not reopening anonymous table access.
- Evidence: [PRODUCTION_ANON_READ_CLOSURE_GATE_20260722.md](PRODUCTION_ANON_READ_CLOSURE_GATE_20260722.md).

## Post-Roadmap Gate 4B: Providerless Public Quiz Abuse Protection in QA — 2026-07-22

- QA now routes public quiz submissions through one public Edge Function, strict shared/server contracts, HMAC pseudonymous throttling and one private transactional RPC.
- The disposable PostgreSQL proof, exact QA migration apply, Edge deployment, 12-case synthetic matrix, custom-log privacy scan and exact cleanup passed.
- Anonymous direct quiz RPC execution, direct table inserts and quiz-history reads remain denied; zero synthetic attempts and guard rows remain.
- Production, financial/fiscal domains, migration history and `db push` were untouched. Gate 4C remains separately blocked.
- Evidence: [GATE_4B_PROVIDERLESS_QA_EXECUTION_20260722.md](GATE_4B_PROVIDERLESS_QA_EXECUTION_20260722.md).

## Post-Roadmap Gate 4C: Public Quiz Abuse Protection in Production — 2026-07-23

- Production now serves the QA-proven Edge ingress, strict contract, HMAC throttling and private transactional RPC.
- The completion resumed after migration/secret/Edge/frontend release and verified those operations read-only without repeating them.
- The production 12-case synthetic matrix, authoritative scoring, anonymous-denial checks, custom-log privacy scan and exact cleanup passed.
- Cleanup returned production to six real attempts, zero `PROD-GATE4C-*` attempts and zero guards; financial/fiscal data, real-data digests, sequence state and migration history remained unchanged.
- Both `db push` locks remain active. Gate 5 was not opened.
- Evidence: [GATE_4C_PUBLIC_QUIZ_PRODUCTION_RELEASE_20260723.md](GATE_4C_PUBLIC_QUIZ_PRODUCTION_RELEASE_20260723.md).
