# Performance Plan — Dashboard Analytics V1

## Current baseline risk

The current dashboard loads many complete domain arrays through `useAppData`.

Additional observations:

- invoices load invoice headers and then invoice lines;
- jobs load job headers and then job lines;
- expenses load a broad fiscal/document field set;
- dashboard currently requests many domains;
- current metrics are mostly computed client-side with `useMemo`.

This is acceptable at current scale but can become expensive as history grows.

## Performance principle

Do not optimize with schema changes before measuring.

Implementation should follow three gates:

1. pure analytics over existing loaded data;
2. targeted read projections/range queries if needed;
3. server-side aggregation only with evidence.

## R1 baseline measurements

Before chart implementation, measure with representative data:

- number of invoices/payments/expenses/jobs/clients;
- transferred payload size per domain;
- dashboard route request count;
- dashboard data-ready time;
- JS bundle before chart library;
- main-thread render duration;
- chart resize behavior.

Record baseline and post-change values.

## Data computation

### One analytics model

Compute selected-period cohorts once.

Bad:

```
KpiA filters invoices
ChartA filters invoices again
ChartB groups invoices again
TopClients filters invoices again
```

Preferred:

```
normalized range
  ↓
invoice cohort / payment cohort / expense cohort
  ↓
metrics + series + rankings
```

### Memoization

Memoize the top-level analytics model by:

- source array identity/version;
- selected range;
- approved options.

Do not add `useMemo` to every tiny display component.

## Range-based optimization

If payload size becomes significant, introduce analytics-specific readers that:

- select only required columns;
- filter by relevant date windows;
- avoid invoice/job line fetches for analytics;
- keep RLS/session behavior identical.

Special case: outstanding balance for invoice cohorts may require payment history outside the displayed period. Query design must preserve that semantic.

## Waterfalls

The current loader uses `Promise.all` for required domains, which is good for independent reads.

Do not add chart-level sequential fetches.

Allow independent sections to render when their domains are ready.

## Bundle

Recharts is a proposed new dependency and must have a measured bundle gate.

Implementation should:

- import only required chart components;
- inspect production bundle;
- consider lazy-loading secondary chart blocks only if the measured bundle/render benefit justifies complexity;
- avoid adding both Recharts and another chart runtime.

Do not add Motion and GSAP simultaneously for the same interaction system without a proven reason.

## Render cost

- use stable transformed datasets;
- avoid regenerating large label objects inside render loops;
- cap visible ranking rows;
- render only selected-period data;
- avoid chart animation on every realtime refresh;
- throttle/debounce resize through library/default mechanisms rather than custom global listeners where possible.

## Mobile

At mobile widths:

- reduce tick count;
- reduce visible ranking rows;
- prefer semantic rows over dense charts when labels dominate;
- avoid large SVG node counts for daily series over long ranges.

## Realtime

Current realtime marks data as changed and refreshes with a delay.

Analytics should recompute after data refresh but should not animate the entire page after every update.

## Caching

No new query-cache dependency is recommended for V1 foundation.

If analytics-specific remote queries are later introduced, cache should live in the adapter/data layer with:

- range key;
- authenticated workspace/user boundary;
- stale policy aligned with existing foreground refresh;
- explicit invalidation from current refresh events.

## Server-side aggregation threshold

No fixed row threshold is declared in planning because it would be arbitrary.

Move to server aggregation when measurements show one or more of:

- unacceptable payload growth;
- dashboard data-ready time outside product acceptance target;
- repeated high-cost client aggregation;
- memory pressure on mobile;
- substantial duplicated network transfer.

Any DB-side solution requires a separate schema/security review and migration authorization.

## Performance acceptance targets to establish in implementation

The implementation sprint must record measured targets for:

- route data-ready latency under controlled QA;
- bundle delta;
- no long task caused by initial chart render under test dataset;
- no horizontal resize loop;
- no repeated duplicate analytics request per chart;
- no loading of unused historical rows once an optimized adapter is introduced.

This document intentionally avoids inventing hard millisecond targets before a repository/runtime baseline is measured.
