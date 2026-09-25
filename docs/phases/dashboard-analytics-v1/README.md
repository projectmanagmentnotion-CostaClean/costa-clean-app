# Dashboard Analytics & Business Insights V1

Status: STRATEGIC PLANNING — READY FOR HUMAN REVIEW only after this package is complete.

Repository: `projectmanagmentnotion-CostaClean/costa-clean-app`  
Planning branch: `planning/dashboard-analytics-v1`  
Base branch: `main`  
Base HEAD audited: `368ed1f75ecda0c0f383c6df4ccffee216db76ce`

## Scope

This phase defines the future evolution of Costa Clean Home/Dashboard into a professional business analytics surface without implementing product code, changing Supabase, deploying, invoking Codex, opening a PR, or modifying the orchestrator.

The package is evidence-first. It derives metrics from the real repository instead of designing charts first and searching for data later.

## Strategic conclusion

The repository already contains most of the semantic foundation required for a useful Analytics V1:

- `src/app/dashboardMetrics.ts` already aggregates invoicing, collections, outstanding receivables, expenses and operational signals.
- `src/features/closing/closingDeterministicSummary.ts` and `closingSummaryEngine.ts` provide period-aware deterministic calculations for invoiced, collected, outstanding and expenses.
- `src/features/invoices/paymentState.ts` is the canonical invoice financial-state helper.
- `src/app/useAppData.ts` and `appDataApi.ts` provide a centralized authenticated read path for the domains needed by the dashboard.
- V3 Home already exists in `src/v3/home/` and the repository has a mature V3 design system, semantic tokens, dark/light theme, shared states and reduced-motion infrastructure.
- The existing Home contract is an operational cockpit, not a long report. Analytics must therefore preserve fast decision-making and hand off detail to existing modules.

The correct implementation direction is to extend the existing dashboard/Home architecture, not create a parallel application, second design system, independent data client, or new repository.

## What is explicitly not authorized in this phase

- functional implementation;
- dependency installation;
- Supabase schema/RLS/RPC changes;
- remote Supabase reads beyond existing repository evidence;
- production or Vercel changes;
- Codex execution or threads;
- orchestrator commands or control changes;
- StrategicCommand creation;
- PR, merge or release;
- main branch mutation.

## Proposed V1 business reading

Primary KPI candidates, based on verified current semantics:

1. Facturado del periodo.
2. Cobrado del periodo.
3. Pendiente de cobro.
4. Gastos del periodo.

`Resultado / Beneficio` is deliberately excluded from the primary KPI set until a canonical business definition is approved. The current closing engine does not calculate profit/result and explicitly records missing payroll/hours data.

Secondary analytics may include invoice financial state, expense categories, top clients, completed services and client acquisition only where their definition is demonstrable and useful.

## Important semantic constraints

- Facturado and cobrado are different concepts and use different date sources.
- **Facturado is not yet one canonical cross-module metric:** current Home excludes archived/deleted invoices before its sums, while Closing selects period invoices from the raw loaded array. Neither current invoiced sum explicitly excludes cancelled invoices.
- **Period outstanding also has cohort drift:** Home global outstanding excludes archived/deleted/cancelled invoices, while Closing period outstanding does not apply that same cohort filter before balance calculation.
- “Vencida” must not be displayed: invoice models currently expose `issue_date` but no canonical invoice due date.
- “Resultado/Beneficio” must not be inferred as `facturado - gastos` or `cobrado - gastos`.
- Current expense reads omit optional archived/deleted/cancelled lifecycle fields from `EXPENSES_SELECT`; lifecycle/cancellation treatment must be made explicit before certification.
- Current “active client” semantics mean a visible client whose status is not `inactive`; this does not prove business activity inside an arbitrary historical period.

## Proposed technical shape

Keep domain logic in the existing dashboard feature:

```
src/features/dashboard/
  analytics/
    types.ts
    dateRanges.ts
    metricCatalog.ts
    selectors.ts
    series.ts
    comparisons.ts
    analyticsAdapter.ts
```

Keep V3 presentation close to the existing Home:

```
src/v3/home/
  analytics/
    AnalyticsKpiGrid.tsx
    AnalyticsPeriodControl.tsx
    charts/
    sections/
```

This is a proposal for the future implementation roadmap, not an implemented structure.

## Dependency direction

- **Recharts:** proposed chart engine, not installed. It is the most justified candidate for the complexity requested, but must be introduced in a dedicated implementation gate after bundle/API validation.
- **shadcn Charts:** not a runtime design system decision. shadcn is not installed and should not be introduced as a second visual system. Recharts can be wrapped in Costa Clean primitives/tokens.
- **Motion for React:** not recommended as an initial dependency because the repository already has a governed GSAP motion layer with reduced-motion support. Re-evaluate only if a concrete interaction cannot be implemented cleanly with the existing layer.
- **TanStack Table:** conditional/deferred. The existing V3 list/table patterns are sufficient for a compact recent-activity surface unless advanced sorting/filtering/pagination requirements justify it.
- **Tremor:** reference-only for information architecture and chart composition; no runtime dependency planned.

## Visual governance

Exact visual composition is not finalizable from taste alone. `docs/stitch/DESIGN_SYSTEM_CONSTITUTION.md` is binding and `docs/stitch/DESIGN.md` remains `WAITING_FOR_STITCH` for HOME references. This planning package may define hierarchy, semantics, responsive behavior, interaction contracts and acceptance criteria, but future pixel-level implementation must either use approved HOME Stitch evidence or pass a separately approved design decision.

## Package index

- [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md)
- [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md)
- [METRIC_CATALOG.md](METRIC_CATALOG.md)
- [DATA_SOURCE_MAP.md](DATA_SOURCE_MAP.md)
- [DASHBOARD_INFORMATION_ARCHITECTURE.md](DASHBOARD_INFORMATION_ARCHITECTURE.md)
- [CHART_SPECIFICATION.md](CHART_SPECIFICATION.md)
- [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md)
- [DESIGN_SYSTEM_INTEGRATION.md](DESIGN_SYSTEM_INTEGRATION.md)
- [RESPONSIVE_ACCESSIBILITY.md](RESPONSIVE_ACCESSIBILITY.md)
- [PERFORMANCE_PLAN.md](PERFORMANCE_PLAN.md)
- [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md)
- [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md)
- [TEST_QA_PLAN.md](TEST_QA_PLAN.md)
- [RISKS_AND_DECISIONS.md](RISKS_AND_DECISIONS.md)
- [CODEX_HANDOFF_DRAFT.md](CODEX_HANDOFF_DRAFT.md)

## Exit gate

This phase stops at `READY_FOR_HUMAN_REVIEW`. No implementation sprint is authorized by the existence of these documents.
