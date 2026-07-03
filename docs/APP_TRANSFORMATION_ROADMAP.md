# App Transformation Roadmap

## Purpose

This roadmap defines the phased transformation path for the app, from governance through final hardening, while preserving operational safety.

## Operating Rules

- Diagnose first.
- Preserve current production logic unless the active sprint explicitly targets it.
- Use the UX manual and quality gates as the control layer for every phase.
- Favor small, validated increments over broad redesign attempts.

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

## Success Criteria Across All Phases

- no blind redesigns
- no hidden business-logic changes
- no dependency drift without explicit need
- every phase validated with repo quality gates
- every phase documented honestly
