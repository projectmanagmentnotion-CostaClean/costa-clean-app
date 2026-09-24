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
