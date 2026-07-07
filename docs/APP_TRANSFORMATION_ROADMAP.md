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
