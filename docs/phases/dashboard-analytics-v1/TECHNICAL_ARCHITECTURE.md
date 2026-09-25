# Technical Architecture — Dashboard Analytics V1

## Architecture objective

Create one analytics layer between existing domain data and V3 presentation.

The architecture must prevent:

- one Supabase query per chart;
- duplicate financial formulas;
- chart-library types leaking into domain logic;
- metric definitions drifting between Home, fiscal closing and finance modules.

## Existing boundaries to preserve

- `useAppData.ts`: authenticated domain loading, refresh and partial errors.
- `appDataApi.ts`: canonical REST read functions for most domains.
- `expenseApi.ts`: canonical expense read path.
- `dashboardMetrics.ts`: current cross-domain dashboard metrics.
- closing engines: period financial semantics.
- `paymentState.ts`: invoice financial-state semantics.
- V3 Home: presentation.
- current RLS/auth boundaries.

## Proposed module placement

Do not create a second top-level “dashboard” implementation.

Extend the existing dashboard feature:

```
src/features/dashboard/
  analytics/
    types.ts
    ranges.ts
    granularity.ts
    selectors.ts
    comparisons.ts
    series.ts
    adapter.ts
    index.ts
```

Presentation stays under V3 Home:

```
src/v3/home/
  analytics/
    AnalyticsPeriodControl.tsx
    AnalyticsKpiGrid.tsx
    AnalyticsPrimaryTrend.tsx
    AnalyticsInvoiceState.tsx
    AnalyticsExpenseCategories.tsx
    AnalyticsClientRanking.tsx
    AnalyticsStates.tsx
```

Exact file names remain implementation details; the separation of responsibilities is the contract.

## Core types

Future conceptual types:

```ts
type AnalyticsPreset =
  | '30d'
  | '3m'
  | '6m'
  | '12m'
  | 'current_year'
  | 'custom'

interface AnalyticsRange {
  preset: AnalyticsPreset
  startDate: string
  endDate: string
  comparisonStartDate: string | null
  comparisonEndDate: string | null
  timezone: 'Europe/Madrid'
}

interface MetricResult {
  id: string
  value: number | null
  comparison: {
    previousValue: number | null
    delta: number | null
    deltaPercent: number | null
    comparable: boolean
  }
  status: 'ready' | 'empty' | 'partial' | 'unavailable'
}
```

These are conceptual contracts only; no code is implemented in planning.

## Initial data adapter

V1 foundation should consume current in-memory domain arrays from `useAppData`.

Conceptually:

```
DashboardAnalyticsInput {
  clients
  invoices
  payments
  expenses
  jobs
  domainErrors
  loadedDomains
}
  ↓
buildDashboardAnalyticsModel(input, range)
  ↓
DashboardAnalyticsModel
```

Advantages:

- no new remote permission surface;
- no schema migration;
- reuses current data and RLS;
- deterministic unit tests;
- simple integration with V3 Home.

## Metric computation

Pure selectors should:

1. normalize lifecycle visibility consistently;
2. resolve selected/comparison periods;
3. select domain cohorts;
4. call/reuse existing domain rules;
5. aggregate;
6. return typed results with confidence/state metadata.

Financial formulas should delegate to existing helpers or extracted shared pure functions rather than copy them.

## Period model

Analytics needs rolling presets not present in `FiscalPeriodMode`.

Do not overload fiscal closing types with non-fiscal semantics. Instead:

- create analytics range types;
- reuse date-only helper principles;
- use `Europe/Madrid`;
- provide adapters for month/year/custom when sharing closing semantics;
- keep closing period types unchanged.

## Comparison logic

For rolling presets, compare the immediately preceding equal-length interval.

For current year, preferred comparison is previous year-to-equivalent-date or previous full year only after product decision; label exact dates.

For custom ranges, previous equal-duration range is the default candidate.

Comparison helper must return `comparable=false` when denominator is zero or data semantics do not support history.

## Temporal series

One reusable bucket engine should produce:

```
[
  {
    key,
    label,
    invoiced,
    collected,
    expenses,
    completedJobs?,
    newClients?
  }
]
```

Do not independently bucket each chart.

Bucket rules must be unit-tested across:

- month/year boundaries;
- leap year;
- DST-safe date-only input;
- empty gaps;
- negative/zero values.

## Partial data model

`useAppData` already tracks errors per domain. Analytics model should preserve domain provenance.

Example:

- invoices loaded, payments failed → invoiced may remain ready; collected/outstanding/invoice-financial-state are partial/unavailable.
- expenses failed → expense KPI/chart unavailable; invoice/client sections stay usable.

The dashboard page must not collapse into a single fatal error when one domain fails.

## Query evolution

### Stage A — existing arrays

Use current data; benchmark.

### Stage B — analytics-specific projections

If needed, add read helpers that select only fields required for analytics and restrict date ranges.

Examples:

- invoices without invoice lines;
- jobs without job lines;
- payments in relevant windows;
- expense fields required by the selected views.

This is preferable to a schema change.

### Stage C — server-side aggregation

Only if measured data volume warrants it:

- reviewed RPC/view;
- RLS-equivalent ownership;
- backward compatible;
- no service-role browser use;
- database tests and rollback.

No Stage C artifact is authorized by this planning package.

## Realtime

Do not make charts “live” with constant animation.

Current realtime invalidation can mark analytics stale and trigger the existing scoped refresh path. Recompute the model after refreshed data arrives.

Avoid chart-specific realtime subscriptions.

## Caching

Initial approach:

- reuse existing loaded-domain state;
- pure memoized analytics model at the page/feature boundary;
- do not add another cache library solely for dashboard V1.

If analytics-specific network queries are introduced later, cache policy should be designed at the data adapter, not inside charts.

## Chart boundary

Define Costa Clean wrappers:

```
AnalyticsChartFrame
AnalyticsTooltip
AnalyticsLegend
```

Recharts-specific props remain below that boundary.

## Table boundary

Recent activity should initially reuse V3 list/table primitives.

TanStack Table is introduced only if requirements include complex sorting/filtering/pagination/column state that cannot be cleanly expressed with current primitives.

## No schema change conclusion

The core V1 is implementable from existing fields and helpers.

Schema change status: **NOT REQUIRED for foundation**.

Potential future optimization is evidence-driven, not assumed.
