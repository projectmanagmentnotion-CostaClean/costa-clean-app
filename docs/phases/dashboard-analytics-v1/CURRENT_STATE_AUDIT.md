# Current State Audit — Dashboard Analytics V1

## Audit boundary

Evidence source: repository `projectmanagmentnotion-CostaClean/costa-clean-app`, remote `main`, HEAD `368ed1f75ecda0c0f383c6df4ccffee216db76ce`.

This is a repository-only, read-only product/architecture audit. No live Supabase mutation, Vercel action, production request, Codex call or orchestrator action was used.

## Runtime stack

`package.json` establishes:

- React `^19.2.4`;
- React DOM `^19.2.4`;
- Vite `^8.0.0`;
- TypeScript `~5.9.3`;
- Supabase JS `^2.99.2`;
- GSAP `^3.15.0` and `@gsap/react ^2.1.2`;
- Vitest `^4.1.5`;
- Playwright `^1.62.1`.

Not currently installed:

- Tailwind CSS;
- shadcn/ui;
- Recharts;
- Motion for React;
- TanStack Table;
- Tremor.

Therefore any implementation plan that assumes Tailwind/shadcn are already foundational would be incorrect.

## Existing frontend architecture

The application already separates domain features, app-level orchestration and V3 presentation.

Relevant areas:

- `src/app/`: navigation, data loading, theme, business rules, display formatting, dashboard metrics.
- `src/features/dashboard/`: operational dashboard composition, KPIs, incidents, quick actions, motion.
- `src/features/invoices/`, `payments/`, `expenses/`, `jobs/`, `clients/`: domain contracts and helpers.
- `src/features/closing/`, `quarterlyClosing/`, `annualClosing/`: period and fiscal summary engines.
- `src/design-system/`: shared design-system components, tokens and governed motion.
- `src/v3/`: current V3 product presentation, including `src/v3/home/V3HomePage.tsx`.
- `src/pages/HomePage.tsx`: legacy/current page composition still present behind the application shell.

## Current V3 Home

`V3HomePage` currently presents:

- a priority queue from alerts/incidents;
- hero KPI: invoiced this month;
- secondary metric: outstanding receivables;
- secondary metric: open quotes;
- secondary metric: completed services without invoice.

This aligns with the canonical Home/Cockpit contract: Home should show what matters now and hand off detail to domain modules.

The planned Analytics V1 should not discard this operational contract silently. The recommended product direction is:

- keep a compact “needs attention”/priority layer;
- add a business analytics layer with shared period controls;
- keep drill-down links to existing invoices/payments/expenses/jobs/clients;
- avoid turning Home into a long fiscal report.

A human product decision is still required on how dominant analytics should become relative to the current daily cockpit.

## Current dashboard metrics

`src/app/dashboardMetrics.ts` already centralizes:

- total invoiced;
- total collected;
- total expenses;
- invoiced this month;
- collected this month;
- outstanding receivables;
- expenses this month/quarter;
- pending invoices count;
- partially paid invoices count;
- open quotes;
- scheduled jobs;
- completed jobs without invoice;
- accepted quotes without job;
- active client count under current visibility/status semantics;
- several fiscal/document quality indicators.

This is a strong starting point, but it is not yet a general analytics engine:

- date ranges are mostly current month/current quarter or all-time;
- comparisons to previous period are absent;
- temporal series are absent;
- many calculations happen over already-loaded full arrays;
- data inclusion semantics are not packaged as explicit metric contracts;
- charts are not modeled;
- historical client activity semantics are not defined.

## Existing canonical period engine

`src/features/closing/fiscalPeriods.ts` already implements:

- month;
- quarter;
- year;
- custom date range;
- period labels;
- date inclusion.

`closingDeterministicSummary.ts` and `closingSummaryEngine.ts` already compute period-aware:

- invoiced total;
- collected total;
- outstanding total;
- expenses total;
- invoice/payment/expense counts;
- fiscal support/readiness information.

This should be reused or extracted into shared analytics primitives rather than reimplemented independently.

The requested 30d/3m/6m/12m presets are not currently part of the fiscal-period type, so Analytics V1 will need an analytics range model that can interoperate with existing fiscal helpers without changing fiscal-closing semantics.

## Financial semantics discovered

### Facturado

Current engines select invoices whose `issue_date` falls inside the period and sum `invoice.total`.

Important: those period engines do not explicitly exclude cancelled invoices. This is current code behavior. Analytics must not change that silently.

### Cobrado

Payments are filtered by `payment_date` and `payment.amount` is summed. This is distinct from invoice issuance.

### Pendiente de cobro

Existing deterministic logic:

- builds paid amount per invoice from payments;
- uses `invoice.paid_amount` when available, otherwise payment aggregation;
- remaining = `max(invoice.total - paidAmount, 0)`;
- tolerance: 0.009;
- `invoiceSettlement.ts` uses the same tolerance boundary.

The fiscal period engine defines pending as invoices issued in the selected period that still have balance today. The dashboard also has an all-current outstanding metric across all visible invoices. Both are valid but answer different questions and must be labeled separately.

### Invoice financial status

`src/features/invoices/paymentState.ts` defines:

- pending;
- partially_paid;
- paid;
- cancelled.

It separates documentary invoice status from financial state.

### Gastos

Current closing logic selects expenses by fiscal year/quarter fields when applicable, otherwise by `expense_date`, then sums `expense.total`.

The current period engine does not explicitly filter a cancelled expense payment status before summing. This is a semantic review item, not something to “fix” during planning.

### Resultado / beneficio

No canonical calculation was found in dashboard or deterministic closing engines. The blueprint says economic result is preliminary, and the deterministic closing engine explicitly flags that the repository has no real hours or payroll module.

Result/profit is therefore `UNVERIFIED`.

### Vencido

Invoice types/read APIs expose `issue_date` but no canonical invoice due date. The dashboard has an “older than 7 days” operational signal based on issue date; that is not a verified overdue definition.

“Vencido” is therefore `UNVERIFIED` and must not be presented as truth.

## Data model relevant to Analytics V1

### Clients

Read path includes:

- `id`;
- `display_code`;
- `created_at`;
- `full_name`;
- `status`;
- lifecycle fields.

Current active-client logic excludes archived/deleted records and `status === inactive`.

### Invoices

Read path includes:

- `id`;
- `invoice_number` / `display_code`;
- `client_id`;
- optional job/quote/property relationships;
- `issue_date`;
- documentary `status`;
- base, VAT and total;
- lifecycle fields.

Invoice line rows are loaded separately. Most Analytics V1 KPIs do not need invoice lines.

### Payments

Read path includes:

- `invoice_id`;
- `payment_date`;
- `amount`;
- `payment_method`;
- `origin_type`.

### Expenses

Read path includes:

- `expense_date`, accounting/due dates;
- category/subcategory;
- payment status/method;
- subtotal/VAT/total;
- fiscal support/review fields;
- fiscal year/quarter.

Canonical category values currently include:

`materiales`, `transporte`, `combustible`, `herramientas`, `productos_limpieza`, `lavanderia`, `alquiler`, `seguros`, `software`, `telefonia`, `publicidad_marketing`, `gestoria`, `suministros`, `mantenimiento`, `dietas_viajes`, `impuestos_tasas`, `servicios_profesionales`, `otros`.

Analytics must use these actual categories rather than invented examples.

### Jobs / services

Relevant fields:

- client/property/quote relations;
- `scheduled_date`;
- `status`;
- `service_type`;
- billing fields.

Canonical operational states include pending, scheduled, in progress, completed, review and cancelled.

## Data-loading audit

`useAppData.ts` is a centralized domain loader with:

- per-domain loading/error state;
- view-based domain requirements;
- scoped refresh;
- 30-second foreground stale threshold;
- Supabase realtime invalidation;
- 900ms realtime refresh debounce.

The dashboard view currently requests a broad set of domains.

`appDataApi.ts` generally fetches full domain arrays, and invoice/job lines are fetched separately. This is adequate for current scale but is a performance risk for long historical analytics.

Recommended implementation sequence:

1. centralize analytics selectors over existing arrays;
2. eliminate duplicate client-side calculations;
3. add analytics-specific projection/range queries if measured data volume justifies them;
4. consider server-side aggregates only after evidence;
5. avoid schema change unless necessary.

## Design-system audit

The repository already has:

- `DSCard`, `DSButton`, `DSSkeleton`, loading/empty/error primitives;
- semantic design tokens;
- V3 primitives;
- dark/light theme support;
- GSAP motion adapters;
- `useReducedMotion`;
- 44px touch-target rules.

Therefore the dashboard must use Costa Clean primitives/tokens and must not introduce shadcn or Tremor as a second runtime design system.

## Visual authority

`docs/stitch/DESIGN_SYSTEM_CONSTITUTION.md` is binding. It requires mobile-first design and prohibits arbitrary visual values.

`docs/stitch/DESIGN.md` is currently `WAITING_FOR_STITCH` for HOME desktop/mobile references.

Implication: strategic IA and component contracts can be defined now; final visual styling must not be invented.

## Testing/QA audit

Existing repository capabilities include:

- Vitest;
- Playwright;
- authenticated visual QA tooling;
- financial E2E;
- accessibility/mobile quality gates;
- read-only production smoke conventions.

The future implementation does not need a new QA framework.

## CI/CD and deployment

The repository is already connected to the existing production deployment. No parallel Vercel project is required or allowed for this feature.

This planning phase does not inspect or mutate live Vercel state because no deployment is authorized.

## Schema/RPC conclusion

No schema change is required to begin Analytics V1.

Existing repository evidence provides the core data for the recommended V1 metrics. New views/RPCs/indexes should be considered only if implementation benchmarks show that client-side/range-query aggregation is insufficient.

No migration is authorized by this conclusion.
