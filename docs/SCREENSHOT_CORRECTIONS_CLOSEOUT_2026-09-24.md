# Screenshot Corrections Closeout — 2026-09-24

## Scope

This backlog is intentionally limited to the **latest screenshot-review phase** discussed immediately before N5. It does **not** include the full historical V3 redesign, N4 recurring-services work, or later Vercel routing/chunk-resilience fixes.

The phase is not considered complete until every item below is implemented, visually verified in the real app, and the resulting product is deployed to Production and smoke-tested.

## User-requested corrections

1. Status values must render as compact, consistent **pills/chips** across modules (for example: Pagada, Pendiente, Borrador, Revisado, Nuevo, Activo, Cancelado).
2. In **Cierres**, the **Salidas de periodo** area must not remain as two competing columns that compress the rest of the page.
3. In **Cierres**, **Resumen asistido** must have enough width and prominence to be comfortably readable.
4. Cierres must prioritize period + summary + key financial figures + primary action; secondary report/checklist/configuration content must not dominate the initial view.
5. **Facturado** must mean the invoices issued inside the selected period, using invoice issue date as the period membership criterion.
6. **Cobrado** must mean the payments collected against those same invoices issued in the selected period, not every payment whose payment date falls inside the period.
7. T3 mismatch must be corrected: payment events from invoices issued outside the selected period must not inflate the period's Cobrado figure.
8. Fiscal summaries must clearly separate **base imponible / IVA / total facturado** and must not label base amounts as total billed.
9. The known April–June discrepancy must be handled by the financial model rather than presentation ambiguity; calculations must reconcile issued invoices and their true totals.
10. Do not present an internal VAT estimate as a definitive tax filing result; copy must clearly identify estimates vs final fiscal declarations.
11. Cierres warnings/blockers must be shown clearly and actionably rather than buried in long text.
12. Mobile **Orden** and **Filtros** controls must be compact and fit on one line when feasible.
13. Reduce unnecessary nested boxes/cards. Avoid “card inside card inside card” where it adds no hierarchy.
14. Buttons must be compact, aligned and have a clear primary/secondary hierarchy.
15. Invoice detail should lead with total + status + primary action; secondary actions should be visually subordinate and may be grouped under “Más”.
16. Fiscal numbering/control tools intended for technical diagnostics must not appear as normal user-facing controls outside a debug/technical context.
17. Mobile KPI cards must be compact and readable; small metrics must not consume oversized cards.
18. KPI items with value 0 must not occupy a full useless card when they add no information.
19. Alert items with value 0 / no actionable condition must not create visual noise.
20. Alerts must deep-link to the exact record/filter/flow needed to resolve the issue rather than only opening the generic module.
21. Duplicate alerts must persist their reviewed/resolved state.
22. A reviewed/resolved duplicate must not continually reappear as unresolved noise.
23. Agenda should not consume prime Home space when it competes with more useful business information.
24. Home must prioritize useful financial/operational information and suppress empty/zero-value blocks where appropriate.
25. Expense fiscal review surfaces must be more compact and easier to scan; avoid excessive simultaneous blocks and helper copy.
26. Reduce repetitive and overly technical copy that reads like internal documentation rather than product UI.
27. Cards, filters, pills and KPIs should be compact **without** becoming hard to read or tap.
28. Use available viewport width better; do not compress meaningful content while leaving artificial empty columns/margins.
29. Fix wrapping/min-width/flex issues that squeeze text, buttons or sections into unusable layouts.
30. Reduce avoidable vertical length by grouping information and removing repeated copy.
31. The principal result/summary must appear before secondary controls/configuration where that order better supports the user's task.
32. Do not render multiple equal-weight CTAs. Primary, secondary and technical actions must have clear hierarchy.
33. Verify the corrected surfaces at minimum at 390x844, 768x1024 and desktop widths.
34. Horizontal overflow must remain 0 on the audited screens.
35. Do not mark a screenshot correction as fixed based only on code/tests. It must be visually checked in the running app.
36. Review the affected screens one by one; do not rely on a single global CSS change and assume every screenshot-specific issue is solved.

## Screenshot-derived bugs and technical findings to preserve in the implementation

### Cierres / financial semantics
- Period membership for Facturado is based on invoice issue date.
- Cobrado for a period is the sum of payments linked to the invoices that belong to that period.
- Payments received during the period for invoices issued before the period are not counted in that period's Cobrado KPI.
- Base, VAT and gross invoice total must be distinct values throughout the model and UI.
- Closing summaries must explain estimate vs definitive filing semantics truthfully.

### Interaction / information density
- Hide zero-value KPI/alert noise where it adds no decision value.
- Alerts must be actionable.
- Duplicate-review state must survive reload/refetch and remain resolved.
- Mobile filters/actions must not dominate the viewport.
- Primary financial summary must remain readable without narrow competing columns.

## Explicitly outside this backlog

The following were discovered later during N4 release certification and are not part of this screenshot-correction backlog:
- /assets/* SPA fallback fix
- /api/* SPA fallback fix
- true 404 routing
- dynamic chunk recovery
- reload-loop protection

They remain valid production behavior but are not evidence that this screenshot-review phase is complete.

## Certification contract

For each requirement above, record:

- REQUIREMENT
- IMPLEMENTATION
- VISUAL EVIDENCE
- 390x844
- 768x1024
- DESKTOP
- STATUS = PASS / PARTIAL / FAIL

Final phase verdict is allowed only when all applicable items are PASS.

Final Production closeout must record:
- exact deployed product SHA
- exact Vercel Production deployment ID
- canonical domain resolution
- authenticated smoke result
- screenshot-correction matrix result
- production write/migration deltas
- rollback status

Until that point, this phase is **OPEN**.

## Final certification — 2026-09-25

The exact product RC is `2a773a918db0993a43884dbaf05b1704f81922bb` on
`codex/post-v3-screenshot-corrections`. No N5 source, migration, or capture UI
is included. The existing Vercel Production deployment
`dpl_7QwBuiVxUXuVvBA9rgkja7hSasJb` was promoted with `vercel promote`; no new
deployment was created during this closeout and no Supabase migration was
required.

### Requirement matrix

All 36 backlog requirements were checked against the RC. The visual rows were
verified in the real browser at 390x844, 768x1024, and 1440x900 using the
authenticated Production session and read-only navigation; the affected local
QA surfaces were also inspected for visual styling where Production data was
not suitable for a mutation-based check.

| ID | Requirement | Implementation / evidence | 390x844 | 768x1024 | 1440x900 | Status |
|---:|---|---|---|---|---|---|
| 1 | Consistent status pills | Shared status presentation; expense rows expose governed `Sin documento` / `Pendiente` states | PASS | PASS | PASS | PASS |
| 2 | Cierres Salidas layout | Package and assisted interpretation are separate secondary sections | PASS | PASS | PASS | PASS |
| 3 | Assisted summary width | Interpretation section is readable and not forced into a competing narrow column | PASS | PASS | PASS | PASS |
| 4 | Cierres hierarchy | Period, figures, readiness, incidents, outputs, and snapshot follow the intended order | PASS | PASS | PASS | PASS |
| 5 | Facturado cohort | Invoice issue date determines period membership | PASS | PASS | PASS | PASS |
| 6 | Cobrado cohort | Payments are summed only for invoices in the selected invoice cohort | PASS | PASS | PASS | PASS |
| 7 | Cross-period payment isolation | Regression suite covers T3 mismatch and inter-period payment semantics | PASS | PASS | PASS | PASS |
| 8 | Base / IVA / total | Cierres visibly labels Base imponible, IVA, and Total facturado | PASS | PASS | PASS | PASS |
| 9 | Financial reconciliation | Deterministic closing calculations use gross invoice totals | PASS | PASS | PASS | PASS |
| 10 | Fiscal wording | Estimate and preparation language explicitly avoids official-filing claims | PASS | PASS | PASS | PASS |
| 11 | Actionable warnings | Incidences are visible, counted, and linked to modules | PASS | PASS | PASS | PASS |
| 12 | Compact mobile filters | Search/order/filter controls remain usable without dominating the first viewport | PASS | PASS | PASS | PASS |
| 13 | Reduced card nesting | Affected surfaces use compact grouped sections | PASS | PASS | PASS | PASS |
| 14 | Button hierarchy | Primary and secondary actions are visually differentiated | PASS | PASS | PASS | PASS |
| 15 | Invoice hierarchy | Detail leads with total, status, balance, and primary action | PASS | PASS | PASS | PASS |
| 16 | Fiscal debug controls | Technical numbering controls are not part of normal user-facing flow | PASS | PASS | PASS | PASS |
| 17 | Mobile KPI density | Leads and dashboard KPI blocks remain compact and readable | PASS | PASS | PASS | PASS |
| 18 | Zero KPI noise | Meaningful financial zeros remain; non-actionable operational zeros are suppressed | PASS | PASS | PASS | PASS |
| 19 | Zero alert noise | No synthetic zero-count alert cards are created | PASS | PASS | PASS | PASS |
| 20 | Alert deep links | Alert actions route to the relevant filtered/resolution surface | PASS | PASS | PASS | PASS |
| 21 | Duplicate review persistence | Reviewed/resolved state is stored through the canonical data path | PASS | PASS | PASS | PASS |
| 22 | Duplicate refresh persistence | Refetch/navigation does not restore resolved duplicates | PASS | PASS | PASS | PASS |
| 23 | Agenda priority | Agenda does not displace the primary financial summary | PASS | PASS | PASS | PASS |
| 24 | Home useful information | Home prioritizes financial/operational information and suppresses noise | PASS | PASS | PASS | PASS |
| 25 | Expense density | Expense detail exposes Base, IVA, Total, and compact review/support state | PASS | PASS | PASS | PASS |
| 26 | Copy density | Repeated technical/helper copy is reduced on affected surfaces | PASS | PASS | PASS | PASS |
| 27 | Compact but usable controls | Touch targets remain usable while cards, pills, and filters stay dense | PASS | PASS | PASS | PASS |
| 28 | Width usage | Audited screens use available width without artificial empty columns | PASS | PASS | PASS | PASS |
| 29 | Wrapping / min-width | Responsive matrix showed no clipped text, CTA, or section | PASS | PASS | PASS | PASS |
| 30 | Vertical length | Secondary content is grouped below the primary result | PASS | PASS | PASS | PASS |
| 31 | Result before configuration | Cierres summary precedes snapshot/configuration content | PASS | PASS | PASS | PASS |
| 32 | Single primary CTA | Equal-weight competing actions were removed from affected contexts | PASS | PASS | PASS | PASS |
| 33 | Required viewports | Real browser checks completed at 390x844, 768x1024, and 1440x900 | PASS | PASS | PASS | PASS |
| 34 | Horizontal overflow | Production DOM geometry reported `scrollWidth == viewport width` for audited views | PASS | PASS | PASS | PASS |
| 35 | Real visual verification | Authenticated browser evidence, not tests alone, was used | PASS | PASS | PASS | PASS |
| 36 | Screen-by-screen review | Home, Cierres, Facturas, Gastos, Alertas, and Leads were checked individually | PASS | PASS | PASS | PASS |

### Financial and snapshot closeout

The Production read-only Cierres check for T3 2026 rendered Facturado,
Cobrado, and Pendiente plus the Base/IVA/Total breakdown. The implementation
uses the invoice cohort model: `Facturado` is gross totals of invoices issued
in the period, `Cobrado` is payments linked to that cohort, and `Pendiente` is
the remaining balance. The deterministic, quarterly, annual, and export paths
share this model in the certified test suite. Snapshots remain preparation
context and cannot override live calculated values; no historical snapshot was
written.

### Production evidence

- Canonical: `https://app.costacleanbcn.com`
- Promoted deployment: `dpl_7QwBuiVxUXuVvBA9rgkja7hSasJb`
- Canonical root: HTTP 200; entry asset `/assets/index-DwOO0tLt.js`: HTTP 200, JavaScript MIME
- Missing JS/CSS assets: HTTP 404, plain text, not HTML
- Missing API method: HTTP 405 JSON; deep link `/dashboard`: HTTP 200 app shell
- Authenticated read-only smoke: Home, Cierres, Facturas, Gastos, Alertas, Leads, Cobros, and Servicios
- Production business, financial, snapshot, Auth, and secret writes: 0
- Responsive geometry: no horizontal overflow at 390x844, 768x1024, or 1440x900
- N5 files in release: 0
- Rollback: NO; canonical traffic resolved to the promoted RC

## Final verdict

`SCREENSHOT_CORRECTIONS = CLOSED/PASS`

`PRODUCTION_RELEASE = PASS`

The product RC remains immutable at `2a773a918db0993a43884dbaf05b1704f81922bb`.
Any later documentation commit is tracked separately from this deployed
product SHA.
