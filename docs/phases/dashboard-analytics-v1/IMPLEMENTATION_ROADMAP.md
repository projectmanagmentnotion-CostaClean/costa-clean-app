# Implementation Roadmap — Dashboard Analytics V1

Status: FUTURE PLAN ONLY. None of these sprints is authorized by this document.

## Gate H0 — Human decisions and visual authority

Before product implementation:

- review this strategic package;
- decide invoice-cancellation treatment for Facturado;
- decide cancelled-expense treatment for Gastos;
- decide Home balance between daily cockpit and business analytics;
- decide whether “cliente nuevo” means client row creation or conversion event;
- approve the top-client metric dependency on the Facturado definition;
- define current-year comparison behavior;
- provide/approve HOME analytics visual reference under the Stitch governance process or explicitly authorize an alternative evidence path.

Exit: `H0_APPROVED`.

## R1 — Analytics data/metric foundation

### Goal

Create a pure, tested analytics layer without changing visible Home composition.

### Scope

- analytics range types and presets;
- period normalization;
- previous-period comparison;
- shared lifecycle filters;
- verified M01–M09 selectors only as authorized by H0;
- temporal bucket engine;
- typed analytics model;
- adapter over current `useAppData` arrays;
- unit tests.

### Protected

- no new chart library yet;
- no schema/RPC;
- no route changes;
- no visual redesign;
- no result/profit metric.

### Exit evidence

- metric fixture reconciliation against existing closing/dashboard helpers;
- unit tests for zero/null/empty/negative/rounding/date boundaries;
- lint/typecheck/tests/build.

## R2 — Home analytics shell + period controls + KPI layer

### Goal

Integrate period context and the four primary financial KPIs into V3 Home while preserving the approved cockpit behavior.

### Scope

- shared analytics period control;
- Facturado/Cobrado/Pendiente/Gastos KPI components;
- comparisons;
- loading/empty/error/partial states;
- drill-down handoffs to existing modules;
- mobile-first layout.

### Visual prerequisite

Approved Home analytics visual evidence/token extraction under repository governance.

### Exit evidence

- 320/375/390/430/768/820/1024/1280/1440/1920 review;
- dark/light;
- keyboard/focus;
- 44px targets;
- no console errors.

## R3 — Primary temporal chart

### Goal

Add the main Facturado/Cobrado/Gastos evolution chart.

### Dependency decision

Validate and, if approved, install Recharts as the single chart runtime.

### Scope

- chart wrapper primitives;
- semantic tooltip and legend;
- responsive bucket/tick rules;
- textual accessibility summary;
- reduced-motion behavior;
- bundle measurement.

### Exit evidence

- library compatibility and bundle delta recorded;
- visual QA across required widths;
- no direct data query from chart;
- accessibility and reduced-motion tests.

## R4 — Invoice state + expense distribution

### Goal

Add the two highest-confidence secondary analytics blocks.

### Scope

- invoice financial-state aggregate from M06;
- expense category aggregate from M09;
- responsive chart/list transformations;
- module handoff.

### Explicit exclusions

- overdue state;
- result/margin;
- arbitrary expense categories.

## R5 — Business concentration and operations

### Goal

Add only validated high-signal secondary blocks.

Candidates:

- top clients by invoiced amount, after M11 approval;
- completed services;
- new clients, after M10 approval;
- compact recent activity using existing list primitives.

This sprint must not add every candidate automatically. Real-data review chooses the smallest useful set.

TanStack Table remains optional and requires a separate dependency justification.

## R6 — Responsive, accessibility and interaction hardening

### Goal

Certify the complete analytics composition.

Scope:

- all required viewports;
- keyboard;
- focus return;
- touch tooltips;
- reduced motion;
- screen-reader summaries;
- dark/light contrast;
- extreme values;
- loading/empty/error/partial states;
- no horizontal overflow.

Motion uses the existing governed motion layer unless a new dependency has been separately approved.

## R7 — Performance optimization

### Goal

Optimize only measured bottlenecks.

Sequence:

1. profile existing-array adapter;
2. remove duplicate calculations;
3. introduce analytics-specific projections/range queries if justified;
4. consider lazy secondary charts;
5. only then evaluate server-side aggregation.

Schema/RPC/view/index work requires a separate database/security gate and is not assumed.

## R8 — Full regression + production-readiness certification

### Goal

Prove the dashboard without mutating real business data.

Required:

- unit;
- integration;
- component;
- E2E;
- authenticated visual QA;
- existing finance regression;
- accessibility;
- bundle/performance evidence;
- read-only production smoke after an independently authorized deployment gate.

Production testing remains read-only for analytics.

## Rollback philosophy

Each sprint should be independently revertible.

Preferred implementation commits:

- `feat(dashboard): add analytics metric foundation`
- `feat(dashboard): add period-aware KPI layer`
- `feat(dashboard): add primary analytics chart`
- `feat(dashboard): add secondary business analytics`
- `test(dashboard): certify analytics behavior`

Actual branch/PR/release workflow is determined by the later approved execution gate.

## Schema decision checkpoint

Default: no schema change.

A schema proposal may be opened only when:

- measured data volume shows current reads are insufficient;
- a targeted query projection is not enough;
- server-side aggregation produces a material, demonstrated benefit;
- RLS/security equivalence is specified;
- rollback and DB tests exist.

That proposal is a new authorization boundary, not an automatic substep.
