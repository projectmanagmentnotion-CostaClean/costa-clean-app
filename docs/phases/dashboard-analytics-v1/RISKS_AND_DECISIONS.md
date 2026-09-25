# Risks & Decisions — Dashboard Analytics V1

## Decision ledger

### D01 — Extend existing dashboard architecture

**Decision:** YES.  
Use `src/features/dashboard` and V3 Home; no second dashboard subsystem.

### D02 — Schema change for foundation

**Decision:** NO.  
Existing fields/helpers support the core V1. Optimize queries before proposing schema/RPC.

### D03 — Primary KPIs

**Decision proposal:** Facturado, Cobrado, Pendiente, Gastos.  
**Status:** ready for human review.

### D04 — Resultado/Beneficio

**Decision:** EXCLUDE until canonical definition exists.

### D05 — Overdue invoices

**Decision:** EXCLUDE. No canonical invoice due date is present.

### D06 — Chart engine

**Decision proposal:** Recharts as the single future chart runtime, subject to implementation compatibility/bundle gate.

### D07 — shadcn

**Decision:** do not add as a second design system. Pattern/reference only.

### D08 — Motion

**Decision:** use existing governed GSAP/CSS/reduced-motion layer first. Motion for React not justified yet.

### D09 — TanStack Table

**Decision:** deferred/conditional. Existing V3 list primitives first.

### D10 — Tremor

**Decision:** visual/composition reference only; no runtime dependency.

### D11 — Home purpose

**Decision proposal:** evolve Home into a business cockpit with analytics while retaining a compact operational priority layer.

### D12 — Active clients

**Decision:** current active-client count is a snapshot only. Do not create historical active-client trend from current status.

## Open human decisions

### O01 — Invoice cohort and cancelled-record treatment

Current Home and Closing invoice aggregates differ before cancellation is considered: Home excludes archived/deleted invoices, while Closing period selection uses the raw loaded invoice array. Neither current invoiced sum explicitly excludes cancelled invoices.

Choose and document one canonical Analytics cohort policy, then decide cancelled treatment:

- preserve current engine semantics in analytics;
- exclude cancelled invoices from the business KPI and deliberately reconcile closing semantics separately;
- show gross issued vs net-valid with separate explicit metrics.

No implementation should silently choose.

### O02 — Cancelled expense treatment

Current period expense sums do not explicitly remove cancelled payment/lifecycle states.

Human/business rule confirmation required before KPI certification.

### O03 — New client semantics

Possible anchors:

- `clients.created_at`;
- lead conversion timestamp;
- first invoice/service;
- another business event.

Current data supports creation date most directly, but product meaning must be accepted.

### O04 — Home analytics dominance

Choose whether:

- operational priority remains before financial KPIs;
- financial KPIs lead and priority follows;
- analytics becomes a separate Home sub-surface.

Recommended starting point: period + KPIs first, compact priority before primary chart, preserving the cockpit intent.

### O05 — Current-year comparison

Choose:

- YTD vs equivalent dates last year;
- full current year vs full previous year when year is complete;
- no percentage until comparable period exists.

Recommended: YTD vs same elapsed range previous year.

### O06 — Visual reference

HOME is currently `WAITING_FOR_STITCH` in canonical extraction docs. Exact visual implementation requires an approved reference or explicit human exception/alternate design authority.

## Critical risks

### RISK-01 — Financial semantic drift

Severity: HIGH.

If analytics reimplements formulas independently, Home and Fiscal Closing can disagree.

Mitigation:

- reuse/extract existing deterministic helpers;
- cross-reconciliation tests;
- metric catalog as contract.

### RISK-02 — Misleading “profit”

Severity: HIGH.

A visually attractive result KPI may imply accounting truth not supported by the model.

Mitigation: keep M12 blocked.

### RISK-03 — Lifecycle/cancelled-record ambiguity

Severity: HIGH.

Invoice aggregates diverge between Home-visible and Closing-raw cohorts. Expense reads omit optional lifecycle fields and current sums can include payment-state-cancelled records. A business user may therefore expect exclusions that current code does not apply consistently.

Mitigation: H0 cohort/lifecycle decision plus reconciliation tests before certifying financial KPIs.

### RISK-04 — Home becomes a report wall

Severity: MEDIUM-HIGH.

The canonical product says Home is a cockpit.

Mitigation: bounded hierarchy, one main chart, limited secondary analytics, module handoff.

### RISK-05 — Historical active-client falsehood

Severity: MEDIUM-HIGH.

Current status cannot reconstruct past active populations.

Mitigation: do not show historical active trend; use new-client events if approved.

### RISK-06 — Data overfetch

Severity: MEDIUM.

Dashboard currently loads broad arrays and invoice/job lines.

Mitigation: profile, then analytics-specific projections/range reads before DB changes.

### RISK-07 — Parallel design system

Severity: MEDIUM.

Introducing shadcn/Tremor wholesale would conflict with V3/DS/Stitch governance.

Mitigation: Costa Clean wrappers/tokens only.

### RISK-08 — Parallel motion systems

Severity: MEDIUM.

Adding Motion beside governed GSAP can duplicate bundle and interaction patterns.

Mitigation: use existing layer first.

### RISK-09 — Date-range inconsistency

Severity: MEDIUM.

Invoice date, payment date and expense date answer different questions.

Mitigation: metric-specific source date documented; one shared visible range context.

### RISK-10 — Partial load presented as zero

Severity: MEDIUM.

A failed payment request could make “Cobrado = 0” appear factual.

Mitigation: per-domain readiness in analytics model.

### RISK-11 — Chart accessibility

Severity: MEDIUM.

SVG graphics can become color-only/tooltip-only.

Mitigation: textual summaries, semantic legends, keyboard/touch behavior.

### RISK-12 — Missing visual authority

Severity: MEDIUM for implementation, LOW for strategic planning.

Mitigation: close H0 visual reference gate before styling implementation.

## Non-risks / conclusions

- The repository already has enough data to start a V1 without schema mutation.
- The repository already has dark/light, reduced motion and visual QA infrastructure.
- The repository already separates facturado from cobrado.
- Recharts can remain an implementation dependency decision rather than a planning mutation.
