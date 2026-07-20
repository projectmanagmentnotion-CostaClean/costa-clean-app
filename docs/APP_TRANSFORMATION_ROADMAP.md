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
